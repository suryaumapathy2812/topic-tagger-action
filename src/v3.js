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


// Find all .js files and returns their path
function readCodebase(directory) {
    const entries = fs.readdirSync(directory, { withFileTypes: true })
        .filter(file => {

            if (
                file.startsWith('.') ||
                file === 'node_modules' ||
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
        .map(file => {
            const filePath = directory + '/' + file;
            const stats = fs.statSync(filePath);

            const absolutePath = resolve(file);
            core.debug(absolutePath);

            if (stats.isFile() && file.endsWith('.js')) {
                return { path: filePath }
            } else if (stats.isDirectory()) {
                return readCodebase(filePath);
            }
        })
        .filter(entry => entry);

    return filePaths.flat();
}

function extractJsFromHtml(filePath) {
    const htmlContent = fs.readFileSync(filePath, 'utf8');
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
    const ast = espree.parse(code, { ecmaVersion: "latest" });
    return [ast, token];
}

function traverseAST(ast) {

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

        const filePaths = readCodebase(dirctory).flat();

        core.info("** File Paths are \n\n")
        filePaths.forEach(file => core.info(JSON.stringify(file)))

        filePaths
            .forEach(
                (file, index) => {

                    let code = ''

                    if (file.endsWith('.html')) {
                        code = extractJsFromHtml(file).join(" \n\n ");
                        console.log(`JavaScript code in ${file}:\n`, code);
                    } else if (file.endsWith('.js')) {
                        code = fs.readFileSync(file.path, 'utf8');
                    }

                    const tree = generateAbstractSyntaxTree(code)
                    const ast = tree[0];
                    const traversResult = traverseAST(ast);

                    const Implementedtopics = Object.entries(traversResult)
                        .filter((object) => (object[1].matches > 0) ? true : false)
                        .map((object) => ({ topic: object[0], count: object[1].matches }))

                    console.log(`Topics Implemented in ${file.path} are : \n`, Implementedtopics);

                    filePaths[index]["topics"] = Implementedtopics
                })

        return filePaths


    } catch (error) {

        core.info("Failed to tag topics");
        core.info(error)

    }
}

module.exports = executeScript 
