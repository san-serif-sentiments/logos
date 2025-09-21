## README

### Prerequisites for running integration tests

Running `npm test` invokes the `@vscode/test-electron` runner, which requires several system libraries to be available on Linux. Make sure the following packages are installed before executing the test suite:

- `libatk1.0-0`
- `libatk-bridge2.0-0`
- `libgtk-3-0`
- `libx11-xcb1`
- `libnss3`
- `libasound2`

On Debian or Ubuntu you can install them with:

```bash
sudo apt-get install -y libatk1.0-0 libatk-bridge2.0-0 libgtk-3-0 libx11-xcb1 libnss3 libasound2
```

After installing the dependencies, rerun the integration tests with `npm test` to confirm everything works as expected.
