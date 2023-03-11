const core = require('@actions/core');
const topicTagger = require('./src/topicTagger')

// most @actions toolkit packages have async methods
async function run() {
  try {
    const startPoint = core.getInput('start-point');
    core.info(`Starting point will be  ${startPoint}`);

    const filesPaths = topicTagger(startPoint)

    core.debug(filesPaths); // debug is only output if you set the secret `ACTIONS_RUNNER_DEBUG` to true

    const _tags = filesPaths.map(file => file.tokenTags)

    const tags = [...new Set(_tags.flat())]

    core.info('JavaScript topics used in the codebase:');
    core.info(tags);

    core.setOutput('tags', tags);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
