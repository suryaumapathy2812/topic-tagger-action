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

const handleComment = async (tags) => {
    core.info("Entering handleComment")

    // for (const key in process.env) {
    //     core.info(`${key}: ${process.env[key]}`);
    // }

    core.debug(core.getInput('github_token'))
    const tableData = formatTable(tags);

    core.info(JSON.stringify(tableData))

    const octokit = github.getOctokit(core.getInput('github_token'));
    const context = github.context;
    core.info(JSON.stringify(context, null, 2))

    core.debug("Github Event =>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>")
    core.debug(github.event)
    core.debug(JSON.stringify(github.event, null, 2))
    core.debug("Github Event =>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>")


    // Get the pull request number from the event
    let pullRequestId;
    if (context.issue.number) {
        // Return issue number if present
        pullRequestId = context.issue.number;
    } else {
        // Otherwise return issue number from commit
        pullRequestId = (
            await github.rest.repos.listPullRequestsAssociatedWithCommit({
                // eslint-disable-next-line camelcase
                commit_sha: context.sha,
                owner: context.repo.owner,
                repo: context.repo.repo,
            })
        ).data[0].number;
    }
    core.info(pullRequestId)


    // Retrieve comments for the current pull request
    const comments = await octokit.paginate(octokit.rest.issues.listComments, {
        owner: context.repo.owner,
        repo: context.repo.repo,
        // eslint-disable-next-line camelcase
        issue_number: pullRequestId,
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
            issue_number: pullRequestId,
            body: `<!-- GENERATED_TOPIC_TABLE -->\n\n**List of Implemented Topics:**\n\n| Topic          | Subtopic               | Count |\n|----------------|------------------------|-------|\n${tableData}`
        });
        console.log('New comment created.');
    } else {
        core.info('Updating Existing Comment')
        result = await octokit.rest.issues.updateComment({
            owner: context.repo.owner,
            repo: context.repo.repo,
            // eslint-disable-next-line camelcase
            comment_id: generatedComment.id,
            body: `<!-- GENERATED_TOPIC_TABLE -->\n\n**List of Implemented Topics:**\n\n| Topic          | Subtopic               | Count |\n|----------------|------------------------|-------|\n${tableData}`
        });
        console.log('Existing comment updated.');
    }

    core.info('Exiting handleComment');

    return result

};


module.exports = handleComment
