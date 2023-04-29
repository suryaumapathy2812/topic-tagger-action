const core = require("@actions/core")
const { readCodebase, extractJsCode, tagTopics } = require("./common.js")


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

const executionScript = async (directory) => {
    try {

        core.info("Using V4 of topic tagging");

        const filePaths = readCodebase(directory).flat();
        console.info("** File Paths are \n")
        console.info(filePaths.map(file => JSON.stringify(file)))


        const codeChunks = filePaths.map(file => {
            return extractJsCode(file)
        })
        console.info("**No Of extracted JS Code: \n")
        console.info(codeChunks.length)


        const implementations = []

        for (const code of codeChunks) {
            const concepts = tagTopics(code);
            core.info(JSON.stringify(concepts, null, 2))
            // code.concepts = concepts
            implementations.push(concepts)
        }

        const consolidatedData = implementations
            .reduce((accumulator, currentObject) => mergeDeep(accumulator, currentObject), {});

        console.debug('Implemented Topics are: \n')
        console.debug(JSON.stringify(consolidatedData, null, 2))
        return consolidatedData

    } catch (error) {
        console.error(error);
    }
}

module.exports = executionScript