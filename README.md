## Установка

1) Шаг 1. Зайдите в директорию smart-builder и выполните
```shell
npm i -g ./
npm run build
```

2) После выполненного шага у вас появится команда
```shell
smart-builder
```

3) Добавление автокомплита
```shell
sudo apt install bash-completion
```

Добавьте в файл ~/.bashrc и ~/.zshrc
```shell
_smart_builder_complete() {
    COMPREPLY=($(smart-builder -L))
}
complete -F _smart_builder_complete smart-builder
```

4) Выполните `source ~/.bashrc` или `source ~/.zshrc` в текущей консоли, чтобы обновить переменные.

## Примеры команд

```shell
smart-builder -e .env webos:debug 
smart-builder -e .env tizen:release
smart-builder -e .env-dev webos:release
smart-builder -e .env-prod webos:release
smart-builder webos:launch -i 192.168.1.222:5522
smart-builder webos:launch                        # emulator
smart-builder webos                               # run "default" task
```

```shell
.smart-builder
.smart-builder/webos/main.yml
.smart-builder/webos/deploy.yml
.smart-builder/webos/debug.yml
.smart-builder/tizen/main.yml
.smart-builder/corejs/main.yml
...
```


```yaml
example:
  desc: 'Example task'
  steps:
    - ':load_env'
    - ':banner'
    - shell.Echo: [ 'Example log message' ]
    - shell.Npm: [ 'install' ]
    - shell.Npm: [ 'install', '-g', 'package' ]
    - shell.AresInspect: [ '--device', 'env.SB_INSTALL?:emulator', '--app', 'com.lg.app.signage', '-o' ]
    - shell.AresInstall: [ '--device', 'env.SB_INSTALL?:emulator' { fn.Glob: 'build/app/*.ipk' } ]
    - shell.AresLaunch: [ '--device', 'env.SB_INSTALL?:emulator' 'com.lg.app.signage' ]
  env:
    SB_UPLOAD_TYPE: 'android'
    SB_UPLOAD_FILE: { fn.Glob: 'android/app/build/outputs/apk/standalone/**/*.apk' }
  required:
    - SB_UPLOAD_FILE
    - EXTERNAL_FIELD
  
load_env:
  desc: 'Example load env task'
  steps:
    - edit.Json: [ 'html/app.json', [ 'name' ], 'SmartPlayer' ]
    - edit.Json: [ 'html/app.json', [ 'displayName' ], env.SB_APPLICATION_NAME ]
    - edit.Json: [ 'html/app.json', [ 'enableExtendedLanguages' ], 'env.SB_ENABLE_EXTENDED_LANGUAGES?true:false' ]
    - edit.Text:
        - 'android/app/src/main/res/xml/network_security_config.xml'
        - "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n"
        - "<network-security-config>\n"
        - "\t<base-config>\n"
        - "\t\t<trust-anchors>\n"
        - "\t\t\t<certificates src=\"system\"/>\n"
        - "\t\t</trust-anchors>\n"
        - "\t</base-config>\n"
        - "</network-security-config>"
  env:
    SB_URL_SCHEME: 'env.SB_FORCE_HTTP?http:https'

clean_extra_ca:
  steps:
    - shell.Clean: 'android/app/src/main/res/raw/extra_ca.pem'

banner:
  steps:
    - download.Png: [ env.SB_ANDROID_BANNER, 'android/app/src/main/res/drawable-xxxhdpi/banner.png', 640, 360 ]
```