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

const handleComment = async (tags, githubToken) => {
    core.info("Entering handleComment")
    const commentId = core.getInput('tags_comment_id');
    const tableData = formatTable(tags);

    core.info(JSON.stringify(tableData))

    const octokit = github.getOctokit(githubToken);
    const context = github.context;
    core.info(JSON.stringify(context, null, 2))

    // Retrieve comments for the current pull request
    const comments = await octokit.paginate(octokit.rest.issues.listComments, {
        owner: context.repo.owner,
        repo: context.repo.repo,
        // eslint-disable-next-line camelcase
        issue_number: context.payload.pull_request.number,
    });
    core.info(JSON.stringify(comments, null, 2));


    const generatedComment = comments.find((comment) => comment.body.includes('<!-- GENERATED_TOPIC_TABLE -->'));
    core.info(JSON.stringify(generatedComment, null, 2));

    let result;

    if (!generatedComment) {
        core.info('Creating new Comment')
        result = await octokit.rest.issues.createComment({
            owner: context.repo.owner,
            repo: context.repo.repo,
            // eslint-disable-next-line camelcase
            issue_number: context.payload.pull_request.number,
            body: `<!-- GENERATED_TOPIC_TABLE -->\n\n**List of Implemented Topics:**\n\n| Topic          | Subtopic               | Count |\n|----------------|------------------------|-------|\n${tableData}`
        });
        console.log('New comment created.');
    } else {
        core.info('Updating Existing Comment')
        result = await octokit.rest.issues.updateComment({
            owner: context.repo.owner,
            repo: context.repo.repo,
            // eslint-disable-next-line camelcase
            comment_id: commentId,
            body: `<!-- GENERATED_TOPIC_TABLE -->\n\n**List of Implemented Topics:**\n\n| Topic          | Subtopic               | Count |\n|----------------|------------------------|-------|\n${tableData}`
        });
        console.log('Existing comment updated.');
    }

    core.info('Exiting handleComment');

    return result

};


module.exports = handleComment
