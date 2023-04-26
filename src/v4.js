const esprima = require('esprima'); // If using Node.js and npm
const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const cheerio = require("cheerio");

function extractCodeChunks(code) {

    let parsedCode;

    try {
        parsedCode = esprima.parseScript(code, { range: true, tokens: true, comment: true });
    } catch (error) {
        return false
    }

    const chunks = [];
    const extractedRanges = [];

    function isOverlapping(range1, range2) {
        return range1[0] < range2[1] && range1[1] > range2[0];
    }

    function isExtracted(range) {
        for (const extractedRange of extractedRanges) {
            if (isOverlapping(range, extractedRange)) {
                return true;
            }
        }
        return false;
    }

    parsedCode.body.forEach((node) => {
        if (!isExtracted(node.range)) {
            const chunk = code.slice(node.range[0], node.range[1]);
            chunks.push(chunk);
            extractedRanges.push(node.range);
        }
    });

    return chunks;
}
function generateAST(code) {
    try {
        const ast = parser.parse(code, {
            sourceType: 'module',
            plugins: [],
        });

        return ast;
    } catch (error) {
        console.error('Error generating AST:', error);
        return null;
    }
}

function analyzeAST(ast, conceptPatterns) {
    const conceptsFound = {};

    traverse(ast, {
        enter(path) {
            for (const topic in conceptPatterns) {
                if (!conceptsFound[topic]) {
                    conceptsFound[topic] = {};
                }

                const concepts = conceptPatterns[topic];

                for (const concept in concepts) {
                    const patterns = concepts[concept];
                    for (const pattern of patterns) {
                        if (pattern(path)) {
                            if (!conceptsFound[topic][concept]) {
                                conceptsFound[topic][concept] = 0;
                            }
                            conceptsFound[topic][concept]++;
                            break;
                        }
                    }
                }
            }
        },
    });

    return conceptsFound;
}

const conceptPatterns = {
    Variables: {
        Variables: [
            (path) => path.isVariableDeclaration(),
        ],
    },
    Array: {
        'Array Declarations': [
            (path) => (
                path.isVariableDeclarator()
                && path.get('init').isArrayExpression()
            ),
        ],
        'Array Methods': [
            (path) => (
                path.isCallExpression()
                && path.get('callee').isMemberExpression()
                && ['map', 'filter', 'reduce', 'forEach'].includes(path.get('callee.property').node.name)
            ),
        ],
    },
    Object: {
        'Object Declarations': [
            (path) => (
                path.isVariableDeclarator()
                && path.get('init').isObjectExpression()
            ),
        ],
        'Object Methods': [
            (path) => (
                path.isObjectMethod() || (
                    path.isObjectProperty()
                    && (path.get('value').isFunctionExpression() || path.get('value').isArrowFunctionExpression())
                )
            ),
        ],
    },
    Sets: {
        'Sets Declarations': [
            (path) => (
                path.isVariableDeclarator()
                && path.get('init').isCallExpression()
                && path.get('init.callee').isIdentifier({ name: 'Set' })
            ),
        ],
    },
    Maps: {
        'Maps Declarations': [
            (path) => (
                path.isVariableDeclarator()
                && path.get('init').isCallExpression()
                && path.get('init.callee').isIdentifier({ name: 'Map' })
            ),
        ],
    },
    Loops: {
        'For Loops': [
            (path) => path.isForStatement(),
        ],
        'While Loops': [
            (path) => path.isWhileStatement(),
        ],
        'Do-While Loops': [
            (path) => path.isDoWhileStatement(),
        ],
        'For-Of Loops': [
            (path) => path.isForOfStatement(),
        ],
        'For-In Loops': [
            (path) => path.isForInStatement(),
        ],
        'Nested Loops': [
            (path) => (
                path.isForStatement() || path.isWhileStatement() || path.isDoWhileStatement()
            ) && (
                    path.findParent((parentPath) => (
                        // eslint-disable-next-line max-len
                        parentPath.isForStatement() || parentPath.isWhileStatement() || parentPath.isDoWhileStatement()
                    ))
                ),
        ],

    },
    Functions: {
        'Function Declarations': [
            (path) => path.isFunctionDeclaration(),
        ],
        'Arrow Functions': [
            (path) => path.isArrowFunctionExpression(),
        ],
        'IIFE Functions': [
            (path) => (
                path.isCallExpression()
                && (path.get('callee').isFunctionExpression() || path.get('callee').isArrowFunctionExpression())
            ),
        ],
        'Nameless Functions': [
            (path) => path.isFunctionExpression(),
        ],
    },
    Operators: {
        'Arithmetic Operators': [
            (path) => (
                path.isBinaryExpression()
                && ['+', '-', '*', '/', '%', '**'].includes(path.node.operator)
            ),
        ],
        'Comparison Operators': [
            (path) => (
                path.isBinaryExpression()
                && ['==', '===', '!=', '!==', '>', '>=', '<', '<='].includes(path.node.operator)
            ),
        ],
        'Logical Operators': [
            (path) => (
                path.isLogicalExpression()
                && ['&&', '||', '??'].includes(path.node.operator)
            ),
        ],
        'Unary Operators': [
            (path) => (
                path.isUnaryExpression()
                && ['+', '-', '!', '~', 'typeof', 'void', 'delete'].includes(path.node.operator)
            ),
        ],
        'Ternary Operator': [
            (path) => path.isConditionalExpression(),
        ],
    },
    'Error Handling': {
        'Try Statements': [
            (path) => path.isTryStatement(),
        ],
        'Catch Statements': [
            (path) => path.isCatchClause(),
        ],
        'Throw Statements': [
            (path) => path.isThrowStatement(),
        ],
    },
    Classes: {
        'Class Declarations': [
            (path) => path.isClassDeclaration(),
        ],
        'Class Expressions': [
            (path) => path.isClassExpression(),
        ],
        'Constructor Methods': [
            (path) => (
                path.isClassMethod()
                && path.node.kind === 'constructor'
            ),
        ],
        'Instance Methods': [
            (path) => (
                path.isClassMethod()
                && path.node.kind !== 'constructor'
                && !path.node.static
            ),
        ],
        'Static Methods': [
            (path) => (
                path.isClassMethod()
                && path.node.kind !== 'constructor'
                && path.node.static
            ),
        ],
    },
    Conditionals: {
        'If Statements': [
            (path) => path.isIfStatement(),
        ],
        'Else Statements': [
            (path) => path.isIfStatement() && path.node.alternate && path.node.alternate.type === 'BlockStatement',
        ],
        'Else If Statements': [
            (path) => path.isIfStatement() && path.node.alternate && path.node.alternate.type === 'IfStatement',
        ],
        'Switch Statements': [
            (path) => path.isSwitchStatement(),
        ],
    },
    'Timing Events': {
        setTimeout: [
            (path) => path.isCallExpression() && path.get('callee').isIdentifier({ name: 'setTimeout' }),
        ],
        setInterval: [
            (path) => path.isCallExpression() && path.get('callee').isIdentifier({ name: 'setInterval' }),
        ],
    },
    ES5: {
        'Spread Operator': [
            (path) => path.isSpreadElement(),
        ],
        'Destructuring Assignment': [
            (path) => path.isObjectPattern() || path.isArrayPattern(),
        ],
    },
    AJAX: {
        Async: [
            (path) => (path.isFunction() && path.node.async),
        ],
        Promise: [
            (path) => path.isNewExpression() && path.get('callee').isIdentifier({ name: 'Promise' }),
        ],
        Await: [
            (path) => path.isCallExpression() && path.get('callee').isIdentifier({ name: 'await' }),
        ],
        Fetch: [
            (path) => path.isCallExpression() && path.get('callee').isIdentifier({ name: 'fetch' }),
        ],
    },
    DOM: {
        'Event Listeners': [
            (path) => (
                path.isCallExpression()
                && path.get('callee').isMemberExpression()
                && path.get('callee.property').isIdentifier({ name: 'addEventListener' })
            ),
        ],
        querySelector: [
            (path) => (
                path.isCallExpression()
                && path.get('callee').isMemberExpression()
                && path.get('callee.property').isIdentifier({ name: 'querySelector' })
            ),
        ],
        createElement: [
            (path) => (
                path.isCallExpression()
                && path.get('callee').isMemberExpression()
                && path.get('callee.property').isIdentifier({ name: 'createElement' })
            ),
        ],
        appendChild: [
            (path) => (
                path.isCallExpression()
                && path.get('callee').isMemberExpression()
                && path.get('callee.property').isIdentifier({ name: 'appendChild' })
            ),
        ],
        prependChild: [
            (path) => (
                path.isCallExpression()
                && path.get('callee').isMemberExpression()
                && path.get('callee.property').isIdentifier({ name: 'prependChild' })
            ),
        ],
    },
    Forms: {
        'Form Controls': [
            (path) => (
                path.isCallExpression()
                && path.get('callee').isMemberExpression()
                && ['reset', 'submit'].includes(path.get('callee.property').node.name)
            ),
        ],
        'Form Elements': [
            (path) => (
                path.isCallExpression()
                && path.get('callee').isMemberExpression()
                && ['elements'].includes(path.get('callee.property').node.name)
            ),
        ],
        'Form Validation': [
            (path) => (
                path.isCallExpression()
                && path.get('callee').isMemberExpression()
                && ['checkValidity', 'reportValidity', 'setCustomValidity'].includes(path.get('callee.property').node.name)
            ),
        ],
    },
    Events: {
        'Click Events': [
            (path) => (
                path.isCallExpression()
                && path.get('callee').isMemberExpression()
                && ['click', 'dblclick'].includes(path.get('callee.property').node.name)
            ),
        ],
        'Change Events': [
            (path) => (
                path.isCallExpression()
                && path.get('callee').isMemberExpression()
                && ['change', 'input', 'select'].includes(path.get('callee.property').node.name)
            ),
        ],
        'Keyboard Events': [
            (path) => (
                path.isCallExpression()
                && path.get('callee').isMemberExpression()
                && ['keydown', 'keyup', 'keypress'].includes(path.get('callee.property').node.name)
            ),
        ],
        'Mouse Events': [
            (path) => (
                path.isCallExpression()
                && path.get('callee').isMemberExpression()
                && ['mousedown', 'mouseup', 'mousemove', 'mouseover', 'mouseout', 'mouseenter', 'mouseleave'].includes(path.get('callee.property').node.name)
            ),
        ],
    },
    'Web API': {
        localStorage: [
            (path) => (
                path.isCallExpression()
                && path.get('callee').isMemberExpression()
                && ['setItem', 'getItem', 'removeItem', 'clear'].includes(path.get('callee.property').node.name)
                && path.get('callee.object').isIdentifier({ name: 'localStorage' })
            ),
        ],
        sessionStorage: [
            (path) => (
                path.isCallExpression()
                && path.get('callee').isMemberExpression()
                && ['setItem', 'getItem', 'removeItem', 'clear'].includes(path.get('callee.property').node.name)
                && path.get('callee.object').isIdentifier({ name: 'sessionStorage' })
            ),
        ],
        cookies: [
            (path) => (
                path.isAssignmentExpression()
                && path.get('left').isMemberExpression()
                && path.get('left.object').isIdentifier({ name: 'document' })
                && path.get('left.property').isIdentifier({ name: 'cookie' })
            ),
        ],
        'URL Params': [
            (path) => (
                path.isNewExpression()
                && path.get('callee').isIdentifier({ name: 'URLSearchParams' })
            ),
        ],
    },
};

function mergeDeep(target, ...sources) {
    if (!sources.length) return target;
    const source = sources.shift();

    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) Object.assign(target, { [key]: {} });
                mergeDeep(target[key], source[key]);
            } else if (Array.isArray(source[key]) && source[key].length === 0) {
                // Ignore empty arrays
            } else if (typeof source[key] === 'number' && target[key] !== undefined) {
                target[key] += source[key];
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }

    return mergeDeep(target, ...sources);
}

function isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
}

function readCodebase(directory) {
    const entries = fs.readdirSync(directory, { withFileTypes: true })
        .filter(({ name: file }) => {

            if (
                file.startsWith('.') ||
                file === 'node_modules' ||
                file === 'dist' ||
                file.includes(".config") ||
                file.includes(".bundle.js") ||
                // file.includes("bootstrap.js") ||
                file.includes(".esm.js") ||
                file.includes(".cjs.js") ||
                file.includes(".min.js") ||
                file.includes(".test.js")
            ) {
                return false;
            } else {
                return true
            }

        });

    const filePaths = entries
        .map(({ name: file }) => {
            const filePath = directory + '/' + file;
            const stats = fs.statSync(filePath);

            if (stats.isDirectory()) return readCodebase(filePath)

            if (stats.isFile() && (file.endsWith('.js') || file.endsWith(".html"))) {
                return { path: filePath }
            }
        })
        .filter(entry => entry);

    return filePaths.flat();
}


function extractJsFromHtml(filePath) {
    const htmlContent = fs.readFileSync(filePath.path, 'utf8');
    const $ = cheerio.load(htmlContent);
    const scriptTags = $('script');

    const scripts = [];
    scriptTags.each((_, scriptTag) => {
        const scriptContent = $(scriptTag).html();
        if (scriptContent) {
            scripts.push(scriptContent);
        }
    });

    return scripts;
}


const executionScript = (directory) => {
    try {

        console.log("Using V4 of topic tagging");

        const filePaths = readCodebase(directory).flat();

        console.info("** File Paths are \n")
        console.info(filePaths.map(file => JSON.stringify(file)))

        let index = 0;

        const implementations = []

        filePaths
            .forEach(file => {

                console.log(file)
                let code = ''

                if ((file.path).endsWith('.html')) {
                    code = extractJsFromHtml(file).join(" \n\n ");
                    // console.debug(`JavaScript code in ${file}:\n`, JSON.stringify(code, null, 2));
                } else if ((file.path).endsWith('.js')) {
                    const _code = fs.readFileSync(file.path, 'utf8');
                    code = _code;
                }

                const codeChunks = extractCodeChunks(code);

                if (codeChunks === false) {
                    console.debug(`Skipping file due to error`);
                    index++
                    return
                }


                const analysisResults = codeChunks.map((chunk) => {
                    const ast = generateAST(chunk);
                    const concepts = ast ? analyzeAST(ast, conceptPatterns) : [];
                    return { chunk, concepts };
                });

                const temporary = analysisResults
                    .reduce((accumulator, currentObject) => mergeDeep(accumulator, currentObject), {});

                const finalResult = temporary.concepts;
                filePaths[index]["topics"] = finalResult
                index++
                implementations.push(finalResult);
            })

        const consolidatedData = implementations
            .reduce((accumulator, currentObject) => mergeDeep(accumulator, currentObject), {});

        console.log('Implemented Topics are: \n')
        console.log(JSON.stringify(consolidatedData, null, 2))
        return consolidatedData

    } catch (error) {
        console.error(error);
    }
}

module.exports = executionScript