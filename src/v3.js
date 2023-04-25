/* eslint-disable no-prototype-builtins */
const core = require('@actions/core');
const fs = require('fs');
const espree = require("espree");
const estraverse = require('estraverse');
const { resolve } = require('path');
const cheerio = require("cheerio");

const topics = {
    "variables": {
        "types": ["VariableDeclaration"],
    },
    "data types": {
        "types": ["Literal", "Identifier"],
    },
    "conditionals": {
        "types": ["IfStatement", "SwitchStatement", "ConditionalExpression"],
    },
    "loops": {
        "types": [
            "ForStatement",
            "WhileStatement",
            "DoWhileStatement",
            "ForInStatement",
            "ForOfStatement",
        ],
    },
    "functions": {
        "types": ["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"],
    },
    "arrays": {
        "types": ["ArrayExpression"],
    },
    "objects": {
        "types": ["ObjectExpression"],
    },
    "classes": {
        "types": ["ClassDeclaration", "ClassExpression"],
    },
    "DOM manipulation": {
        "types": ["CallExpression"],
    },
    "AJAX": {
        "types": ["CallExpression"],
    },
    "event handling": {
        "types": ["CallExpression"],
    },
    "error handling": {
        "types": ["TryStatement"],
    },
    "callbacks": {
        "types": ["CallExpression"],
    },
    "promises": {
        "types": ["CallExpression", "NewExpression"],
    },
    "async/await": {
        "types": ["FunctionDeclaration", "ArrowFunctionExpression"],
    },
};

const extractedCode = {};

function getTopic(type) {

    let topic;

    for (const [key, value] of Object.entries(topics)) {
        if (value.types.includes(type)) {
            topic = key;
            break;
        }
    }

    return topic;
}
// Find all .js files and returns their path
function readCodebase(directory) {
    console.log(fs.readdirSync(directory))
    const entries = fs.readdirSync(directory, { withFileTypes: true })
        .filter(({ name: file }) => {

            if (
                file.startsWith('.') ||
                file === 'node_modules' ||
                file === 'dist' ||
                file.includes(".config") ||
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

            const absolutePath = resolve(file);
            core.debug(absolutePath);

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

function generateAbstractSyntaxTree(code) {
    const token = espree.tokenize(code, { ecmaVersion: "latest" }).filter(_token => _token.type !== 'Punctuator');
    const ast = espree.parse(code, { ecmaVersion: "latest", loc: true });
    return [ast, token];
}

function traverseAST(ast, code) {

    const results = {};

    // Initialize results object
    for (const topic in topics) {
        results[topic] = {
            matches: 0,
            types: []
        };
    }

    estraverse.traverse(ast, {
        enter: function (node) {

            if (extractedCode.hasOwnProperty(node.type)) {
                const snippet = code.substring(node.start, node.end);
                extractedCode[node.type].push(snippet.replace(/[\n\r\s]+/g, ' '));
            }

            for (const topic in topics) {
                if (topics[topic].types.includes(node.type)) {
                    let isMatch = true;

                    // Custom logic for specific topics
                    if (topic === 'DOM manipulation' && node.type === 'CallExpression') {
                        isMatch = node.callee.type === 'MemberExpression' && node.callee.object.name === 'document';
                    } else if (topic === 'AJAX' && node.type === 'CallExpression') {
                        isMatch = (node.callee.type === 'Identifier' && node.callee.name === 'fetch') ||
                            (node.callee.type === 'MemberExpression' && node.callee.object.name === 'XMLHttpRequest') ||
                            (node.callee.type === 'MemberExpression' && node.callee.object.name === '$' && ['ajax', 'get', 'post'].includes(node.callee.property.name));
                    } else if (topic === 'event handling' && node.type === 'CallExpression') {
                        isMatch = node.callee.type === 'MemberExpression' && (node.callee.property.name === 'addEventListener' || node.callee.property.name === 'removeEventListener');
                    } else if (topic === 'callbacks' && node.type === 'CallExpression') {
                        isMatch = ['setTimeout', 'setInterval', 'requestAnimationFrame'].includes(node.callee.name);
                    } else if (topic === 'promises' && (node.type === 'CallExpression' || node.type === 'NewExpression')) {
                        isMatch = (node.callee.type === 'MemberExpression' && node.callee.object.name === 'Promise' && ['resolve', 'reject', 'all', 'race'].includes(node.callee.property.name)) ||
                            (node.callee.type === 'Identifier' && node.callee.name === 'Promise');
                    } else if (topic === 'async/await' && ['FunctionDeclaration', 'ArrowFunctionExpression'].includes(node.type)) {
                        isMatch = node.async;
                    }

                    if (isMatch) {
                        results[topic].matches++;
                        results[topic].types.push(node);
                    }
                }
            }
        },
    });


    return results;

}

const executeScript = function (dirctory) {
    try {
        console.log("Using V3 of topic tagging");

        const filePaths = readCodebase(dirctory).flat();

        core.info("** File Paths are \n")
        core.info(filePaths.map(file => JSON.stringify(file)))


        for (const topic in topics) {
            topics[topic].types.forEach((type) => {
                extractedCode[type] = [];
            });
        }

        filePaths
            .forEach(
                (file, index) => {

                    let code = ''

                    if ((file.path).endsWith('.html')) {
                        code = extractJsFromHtml(file).join(" \n\n ");
                        core.debug(`JavaScript code in ${file}:\n`, code);
                    } else if ((file.path).endsWith('.js')) {
                        const _code = fs.readFileSync(file.path, 'utf8');
                        code = _code;
                    }

                    const tree = generateAbstractSyntaxTree(code)
                    const ast = tree[0];
                    const traversResult = traverseAST(ast, code);

                    const Implementedtopics = Object.entries(traversResult)
                        .filter((object) => (object[1].matches > 0) ? true : false)
                        .map((object) => ({ topic: object[0], count: object[1].matches }))

                    core.info(`\n\n Topics Implemented in ${file.path} are : \n`);
                    core.info(`${JSON.stringify(Implementedtopics)} \n\n`);

                    filePaths[index]["topics"] = Implementedtopics
                })


        core.debug("extractedCode \n ")
        core.debug(JSON.stringify(extractedCode))

        const dataset = Object.entries(extractedCode)
            .map(([key, value]) => {
                return value.map(_value => {
                    const topic = getTopic(key);
                    return { code: _value, labels: { topic: [topic], type: [key] } }
                })
            }).flat()

        core.debug("extractedCode \n ")
        core.debug(JSON.stringify(dataset))

        return filePaths


    } catch (error) {

        core.info("Failed to tag topics");
        core.info(error)

    }
}

module.exports = executeScript 
