# JavaScript Topic Tagging GitHub Action

This GitHub Action generates an list of JavaScript and Concepts that are implemented in the codebase.

## Example Workflow

Here's an example workflow file on how to setup the Topic-Tagger GitHub Action:

```yaml

on:
  pull_request:
    types: [opened, synchronize]
  push:
    branches-ignore:
      - main

jobs:
  hello_world_job:
    runs-on: ubuntu-latest
    name: Topic Tagging
    steps:
      - name: Checkout
        uses: actions/checkout@v3
      - name: Topic Tagger
        id: topic-tagger
        uses: suryaumapathy2812/topic-tagger-action@v1
        with:
          start-point: "./"
          version: "v4"
          github_token: ${{ secrets.GITHUB_TOKEN }}

```