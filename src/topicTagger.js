const core = require('@actions/core');
const fs = require('fs');
const espree = require("espree");


const topics = {

    "variables": {
        "types": ["Identifier"],
        "keywords": ["var", "let", "const", "global", "local", "hoisting", "scope", "closure"]
    },
    "data types": {
        "types": ["Literal"],
        "keywords": ["null", "undefined", "true", "false", "number", "string", "boolean", "symbol", "bigint", "typeof"]
    },
    "conditionals": {
        "types": ["IfStatement", "SwitchStatement"],
        "keywords": ["if", "else", "switch", "case", "default", "ternary operator", "truthy", "falsy"]
    },
    "loops": {
        "types": ["ForStatement", "WhileStatement", "DoWhileStatement", "ForInStatement", "ForOfStatement"],
        "keywords": ["for", "while", "do", "break", "continue", "iterator", "generator"]
    },
    "functions": {
        "types": ["FunctionDeclaration", "ArrowFunctionExpression"],
        "keywords": ["function", "return", "this", "arguments", "call", "apply", "bind", "higher-order function"]
    },
    "arrays": {
        "types": ["ArrayExpression"],
        "keywords": ["push", "pop", "shift", "unshift", "slice", "splice", "forEach", "map", "filter", "reduce", "every", "some"]
    },
    "objects": {
        "types": ["ObjectExpression"],
        "keywords": ["Object", "Object.keys", "Object.values", "Object.assign", "Object.entries", "constructor", "prototype", "inheritance"]
    },
    "classes": {
        "types": ["ClassDeclaration"],
        "keywords": ["class", "extends", "constructor", "super", "get", "set", "static", "private", "public", "protected"]
    },
    "DOM manipulation": {
        "types": ["CallExpression"],
        "keywords": ["document", "querySelector", "querySelectorAll", "getElementById", "createElement", "innerHTML", "setAttribute", "addEventListener", "removeEventListener", "removeChild", "appendChild", "style", "scroll", "requestAnimationFrame"]
    },
    "AJAX": {
        "types": ["CallExpression"],
        "keywords": ["XMLHttpRequest", "fetch", "$.ajax", "$.get", "$.post", "response", "promise", "async", "await"]
    },
    "event handling": {
        "types": ["CallExpression"],
        "keywords": ["addEventListener", "removeEventListener", "event.target", "event.preventDefault", "event.stopPropagation", "event bubbling", "event capturing"]
    },
    "error handling": {
        "types": ["TryStatement"],
        "keywords": ["try", "catch", "finally", "throw", "Error", "stack trace", "debugging"]
    },
    "callbacks": {
        "types": ["CallExpression"],
        "keywords": ["callback", "setTimeout", "setInterval", "requestAnimationFrame", "Promise.resolve", "Promise.reject"]
    },
    "promises": {
        "types": ["CallExpression", "NewExpression"],
        "keywords": ["Promise", "resolve", "reject", "then", "catch", "finally", "async", "await"]
    },
    "async/await": {
        "types": ["FunctionDeclaration", "ArrowFunctionExpression"],
        "keywords": ["async", "await", "Promise.all", "Promise.race"]
    }

}

function readCodebase(directory) {
    const files = fs.readdirSync(directory);

    const filesPaths = []

    files.forEach(file => {
        const filePath = directory + '/' + file;
        const stats = fs.statSync(filePath);

        if (stats.isFile() && file.endsWith('.js')) {

            filesPaths.push({ path: filePath })
            // tagTopics(filePath);

        } else if (stats.isDirectory()) {
            readCodebase(filePath);
        }
    });

    return filesPaths
}

function generateAbstractSyntaxTree(file) {
    const code = fs.readFileSync(file, 'utf8');
    const token = espree.tokenize(code, { ecmaVersion: "latest" }).filter(_token => _token.type !== 'Punctuator');
    const ast = espree.parse(code, { ecmaVersion: "latest" });
    return [ast, token];
}


// function tagTopics(node) {

//     const nodeType = node.type;
//     const totalTags = []

//     if (node.body) {

//         const nodes = []
//         nodes.push(node.body)

//         const subNodeTags = nodes.flat().map(node => tagTopics(node))
//         totalTags.push(...subNodeTags)

//     }

//     if (nodeType === 'ExpressionStatement') {

//         const nodes = []
//         nodes.push(node.expression)

//         const subNodeTags = nodes.map(node => tagTopics(node))
//         totalTags.push(...subNodeTags)

//     }

//     if (nodeType === 'CallExpression') {

//         const subNodeTags = node.arguments.map(node => tagTopics(node))
//         totalTags.push(...subNodeTags)

//     }

//     const tags = [];

//     Object.keys(topics)
//         .forEach(topicName => {

//             const { types } = topics[topicName]

//             if (
//                 // keywords.some((keyword) => nodeType === keyword)
//                 // ||
//                 types.some((type) => nodeType === type)
//             ) {

//                 tags.push(topicName)

//             } else {
//                 // core.info("....")
//             }

//         })

//     const returnArray = [...totalTags.flat(), ...tags.flat()];

//     // core.info(returnArray)

//     return returnArray;


// }


function tagTokenTopic(tokens) {

    const tags = [];

    tokens
        // .filter(_token => _token.type === 'Keyword')
        .forEach(token => {

            const { value } = token;

            Object.keys(topics)
                .forEach(topicName => {

                    const { keywords } = topics[topicName]

                    if (
                        keywords.some((keyword) => value === keyword)
                        // ||
                        // types.some((type) => nodeType === type)
                    ) {
                        tags.push(topicName)
                    }

                })

        })

    return tags

}

const executeScript = function (dir) {
    try {

        const filesPaths = readCodebase(dir);

        core.info(filesPaths);

        filesPaths
            .forEach(
                (file, index) => {
                    const [ast, token] = generateAbstractSyntaxTree(file.path)
                    // const astTags = tagTopics(ast);
                    const tokenTags = tagTokenTopic(token);

                    filesPaths[index]["ast"] = ast
                    filesPaths[index]["token"] = token
                    // filesPaths[index]["astTags"] = [...new Set(astTags)]
                    filesPaths[index]["tokenTags"] = [...new Set(tokenTags)]
                })


        return filesPaths


    } catch (error) {

        core.info("Failed to tag topics");
        core.info(error)

    }
}

module.exports = executeScript