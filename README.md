## Smart Builder

This is a build automation script that allows you to have a full-fledged project build not only through gitlab-ci.yaml, 
jenkins and other CI/CD.
But it also adds more convenient project and environment management for developers during development.

## Requirement
 - Node.js >= 14

## Usage

```text
Usage: smart-builder [options] [target]

Options:
  -e, --env-file <file>  ENVFILE
  -i, --input <value>    Set env variable: SB_INPUT
  -L, --list             Helper from BASH autocomplete
  -h, --help             display help for command
```

## Features

- Support for system ENV variables, .env file, URL download or from a file.
- Configurations on yaml files.
- Reading and changing JSON, XML, YAML files.
- Loading and changing the size of PNG and JPEG images.
- Copying, deleting, searching files by mask, creating folders, other.
- Starting, stopping, pause, restoration of emulators Virtual Box (Webos), Tizen.
- Assembly, installation of packages in emulators Tizen, Webos, debugging through the inspector Devtools.

## Installation

1) Go to the `smart-builder` directory and execute

```shell
npm i -g ./
npm run build
```

2) After the step executed, you will have a console command

```shell
smart-builder
```

3) Adding autocompletion

```shell
sudo apt install bash-completion
```

Add ~/.bashrc and ~/.zshrc to the file

```shell
_smart_builder_complete() {
    COMPREPLY=($(smart-builder -L))
}
complete -F _smart_builder_complete smart-builder
```

4) Run `source ~/.bashrc` or` source ~/.zshrc` in the current console to update variables.

## CLI example

```shell
smart-builder -e .env webos:debug
smart-builder -e .env-prod webos:release
smart-builder webos:install -i 192.168.1.222
smart-builder webos # run "default" task in .smart-builder/webos/main.yaml file
```

## The structure of configuration files

At the root of your project, create the directory `.smart-builder`.

```shell
./.smart-builder/${platform}/${group}.yaml
./.smart-builder/webos/main.yml
./.smart-builder/webos/deploy.yml
./.smart-builder/webos/debug.yml
...
```

## Variable formats

```yaml
task:
  env:
    DEBUG:
      fn.If:
        - env.TB_BUILD_DEBUG
        - '1'
        - '0'
    DEBUG2: [ fn.If: [ env.TB_BUILD_DEBUG, '1', '0' ] ]
    DEBUG3: 'env.SB_FORCE_HTTP?http:https'  # http or https value
    DEBUG4: 'env.SB_INPUT?:1234'            # Value from SB_INPUT or 1234
    DEBUG5: 'https://${SITE}/${API}'
```

All files within a single **platform** are merged into one file during execution.  
If a specific task is not specified via `:`, for example `smart-builder webos:inspect`, the platform will search 
for a file named `main.yaml` and a task named `default` within it.  

Tasks from neighboring platforms can be executed by explicitly referencing them, e.g., `steps: - 'middleware:env'`.

The build for all platforms can be configured in the `default` task within the `.smart-builder/main/main.yaml` file, 
and it will execute when the smart-builder command is run without parameters or platform specifications

```yaml
example:
  autocomplete: false
  desc: 'Example task'
  hint:
    EXTERNAL_FIELD: 'FTP address'
    SB_UPLOAD_TYPE: 'Type file'
  steps:
    - 'middleware:load_env'
    - ':banner'
    - shell.Clean: 'dist'
    - shell.Npm: [ 'run', 'build' ]
    - shell.Copy: [ { fn.Glob: 'android/app/build/${PLATFORM}/*.apk' }, 'dist/app.apk' ]
  env:
    SB_UPLOAD_TYPE: 'android'
  required:
    - EXTERNAL_FIELD
```

List of all operators with examples of syntax.

```yaml
steps:
  - ':load_env'
  - 'platform:load_env'
  - load.Env: 'https://mw.com/api/build-env'
  - load.Env: '/dist/.env-prod'
  - load.Env: '.env-prod'
  - edit.Json: [ 'app.json', [ 'name' ], 'My Company' ]
  - edit.Xml: [ 'config.xml', [ 'widget', 'tizen:application', '0', '$', 'id' ], 'my.app.com' ]
  - edit.Yaml: [ 'app.yaml', [ 'name' ], 'My Company' ]
  - edit.Replace: [ 'app.html', 'id="test"', 'id="new_id"' ]
  - edit.Text:
      - 'android/app/src/main/res/xml/network_security_config.xml'
      - "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n"
      - "<network-security-config>\n"
      - "\t<base-config>\n"
      - "\t\t<trust-anchors>\n"
      - "\t\t\t<certificates src=\"@raw/extra_ca\"/>\n"
      - "\t\t\t<certificates src=\"system\"/>\n"
      - "\t\t</trust-anchors>\n"
      - "\t</base-config>\n"
      - "</network-security-config>"
  - open.Url: 'https://site.com'
  - ares.Install: [ '--device', 'env.SB_INPUT?:emulator', { fn.Glob: 'webos/build/*.ipk' } ] # install
  - ares.Inspect: [ '--device', 'env.SB_INPUT?:emulator', '--app', 'com.lg.app' ]            # debug
  - ares.Launch: [ '--device', 'env.SB_INPUT?:emulator', 'com.lg.app' ]                      # open
  - ares.Launch: [ '--device', 'env.SB_INPUT?:emulator', '--close', 'com.lg.app' ]           # close
  - ares.Install: [ '--device', 'env.SB_INPUT?:emulator', '--remove', 'com.lg.app' ]         # remove
  - tizen.Package: [ 'default', cwd: 'tizen/build' ]
  - tizen.Install: [ { fn.Glob: 'tizen/build/*.wgt' }, 'env.SB_INPUT?:t-0625-1', cwd: 'tizen/build' ]
  - tizen.Run:
      - { fn.Xml: [ 'tizen/build/config.xml', [ 'widget', 'tizen:application', '0', '$', 'id' ] ] }
      - 'env.SB_INPUT?:t-0625-1'
  - tizen.Stop:
      - { fn.Xml: [ 'tizen/build/config.xml', [ 'widget', 'tizen:application', '0', '$', 'id' ] ] }
      - 'env.SB_INPUT?:t-0625-1'
  - tizen.Remove:
      - { fn.Xml: [ 'tizen/build/config.xml', [ 'widget', 'tizen:application', '0', '$', 'id' ] ] }
      - 'env.SB_INPUT?:t-0625-1'
  - tizen.Inspect:
      - { fn.Xml: [ 'tizen/build/config.xml', [ 'widget', 'tizen:application', '0', '$', 'id' ] ] }
  - tizen.EmulatorStart: [ 'tizen-6.0', 't-0625-1' ]
  - vbox.Start: "Ubuntu 14.04"
  - vbox.Pause: "Ubuntu 14.04"
  - vbox.Resume: "Ubuntu 14.04"
  - shell.Clean: 'dist'
  - shell.Clean: { fn.Glob: 'tizen/build/*.wgt' }
  - shell.Copy: [ 'assets/icon.png', 'dist/icon.png' ]
  - shell.Echo: [ 'test' ]
  - shell.Git: [ 'checkout', 'main', cwd: 'webos' ]
  - shell.Gulp: [ 'taskName', cwd: 'webos' ]
  - shell.Mkdir: 'dist'
  - shell.Npm: [ 'install', '-g', 'pkg' ]
  - shell.Yarn: [ 'run', 'build' ]
  - shell.Sh: [ 'ls', '-1', cwd: 'dist' ]
  - shell.Sh: [ 'sudo', 'modprobe', 'kvm' ]
  - console.Log: [ 'test' ]
  - console.Dir: [ 'test' ]
  - download.File: [ 'https://site.com/archive.tar.gz', 'dist/archive.tar.gz' ]
  - download.Png: [ 'https://site.com/image.png', 'assets/splash.png' 'inside', '100' ] # 'contain', 'cover', 'fill', 'inside', 'outside'
  - download.Jpeg: [ 'https://site.com/image.jpeg', 'assets/splash.jpeg', 'inside', '200', '100' ]

  # Examples of functional fn.* commands for calculating values 
  - shell.Echo: [ 'Branch:', { fn.Git: [ 'rev-parse', '--abbrev-ref', 'HEAD', cwd: 'webos' ] } ]
  - shell.Echo: [ 'Branch:', { fn.Sh: [ 'git', 'rev-parse', '--abbrev-ref', 'HEAD', cwd: 'webos' ] }, cwd: 'webos' ]
  - shell.Echo: [ 'Branch:', { fn.GitFindBranch: [ env.SB_INPUT, cwd: 'webos' ] }, cwd: 'webos' ]
  - shell.Echo: [ 'App Id:', { fn.Xml: [ 'tizen/build/config.xml', [ 'widget', 'tizen:application', '0', '$', 'id' ] ] } ]
  - shell.Echo: [ 'App Name:', { fn.Json: [ 'app.json', [ 'name' ] ] } ]
  - shell.Echo: [ 'App Name:', { fn.Yaml: [ 'app.yaml', [ 'name' ] ] } ]
  - shell.Echo: [ 'Debug Mode:', { fn.If: [ env.DEBUG, 'yes', 'no' ] } ]
```