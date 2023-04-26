const core = require('@actions/core');
const github = require('@actions/github');

const formatTable = (topicOutput) => {
    let tableRows = '';
    for (const topic in topicOutput) {
        for (const subtopic in topicOutput[topic]) {
            const count = topicOutput[topic][subtopic];
            tableRows += `| ${topic} | ${subtopic} | ${count} |\n`;
        }
    }
    return tableRows;
};

const handleComment = async () => {
    const tags = JSON.parse(core.getInput('tags'));
    const commentId = core.getInput('tags_comment_id');
    const tableData = formatTable(tags);

    const octokit = github.getOctokit(core.getInput('github_token'));
    const context = github.context;

    if (!commentId || commentId === 'null') {
        await octokit.rest.issues.createComment({
            owner: context.repo.owner,
            repo: context.repo.repo,
            // eslint-disable-next-line camelcase
            issue_number: context.payload.pull_request.number,
            body: `<!-- GENERATED_TOPIC_TABLE -->\n\n**List of Implemented Topics:**\n\n| Topic          | Subtopic               | Count |\n|----------------|------------------------|-------|\n${tableData}`
        });
        console.log('New comment created.');
    } else {
        await octokit.rest.issues.updateComment({
            owner: context.repo.owner,
            repo: context.repo.repo,
            // eslint-disable-next-line camelcase
            comment_id: commentId,
            body: `<!-- GENERATED_TOPIC_TABLE -->\n\n**List of Implemented Topics:**\n\n| Topic          | Subtopic               | Count |\n|----------------|------------------------|-------|\n${tableData}`
        });
        console.log('Existing comment updated.');
    }
};


module.exports = handleComment
