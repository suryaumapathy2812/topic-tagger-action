const core = require('@actions/core');
const topicTagger = require('./src/topicTagger')

// most @actions toolkit packages have async methods
async function run() {
  try {
    const startPoint = core.getInput('start-point');
    core.info(`Starting point will be  ${startPoint}`);

    const version = core.getInput('version');
    core.info(`The version will be using is: ${version}`);

    let filePaths;

    switch (version) {
      case "v1":
        filePaths = topicTagger.v1(startPoint);
        break;
      case "v2":
        filePaths = topicTagger.v2(startPoint);
        break;
      case "v3":
        filePaths = topicTagger.v3(startPoint);
        break;
      case "v4":
        filePaths = topicTagger.v4(startPoint);
        break;
      default:
        filePaths = topicTagger.v2(startPoint);
        break;
    }


    core.debug(JSON.stringify(filePaths)); // debug is only output if you set the secret `ACTIONS_RUNNER_DEBUG` to true


    if (version === 'v4') {
      core.setOutput('tags', filePaths);
      return;
    }

    const _tags = filePaths.map(file => file.topics)
    const tags = [...new Set(_tags.flat())]
    core.info('JavaScript topics used in the codebase:');
    core.info(JSON.stringify(tags, null, 4));

    core.setOutput('tags', tags);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
