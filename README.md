## Вступление

**Smart Builder** - это скрипт автоматизации сборки, позволяющий иметь полноценную сборку проекта не только через 
gitlab-ci.yaml, jenkins и т.д., но и позволяет делать полноценные продуктовые сборки с любого ПК разработчиков.  
И добавляет разработчикам более удобное управление проектом и окружением проекта во время разработки. 

## Требования
 - Node.js >= 14

## Возможности

- Поддержка системных ENV переменных, .env файла, загрузка по url или из файла.
- Поддержка формата YAML в конфигурациях сборки.
- Поддержка чтения и записи форматов JSON, XML, YAML.
- Загрузка и изменение размера изображений.
- Копирование, удаление, поиск файлов по маске, создание папок.
- Запуск, остановка, пауза, восстановление эмуляторов Virtual Box (WebOS), Tizen.
- Сборка, установка пакетов в эмуляторах Tizen, WebOS, отладка через инспектор DevTools.

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
smart-builder -e .env-prod webos:release
smart-builder webos:install -i 192.168.1.222
smart-builder webos                               # run "default" task
```

## Структура файлов конфигураций

```shell
./.smart-builder/${platform}/${group}.yaml
./.smart-builder/webos/main.yml
./.smart-builder/webos/deploy.yml
./.smart-builder/webos/debug.yml
...
```

## Форматы переменных

```yaml
task:
  env:
    DEBUG:
      fn.If:
        - env.TB_BUILD_DEBUG
        - '1'
        - '0'
    DEBUG2: [ fn.If: [ env.TB_BUILD_DEBUG, '1', '0' ] ]
    DEBUG3: 'env.SB_FORCE_HTTP?http:https'  # Значение http или https
    DEBUG4: 'env.SB_INPUT?:1234'            # Значение из SB_INPUT либо 1234
    DEBUG5: 'https://${SITE}/${API}'
```

Все файлы внутри одной **платформы** при исполнении склеиваются в один.  

Если не указана конкретная задача через `:`, пример `smart-builder webos:inspect`, то в платформе будет искаться файл 
с именем `main.yaml`, а в нём задача с именем `default`.  

Можно выполнять задачи из соседних платформ, указывая её, пример `steps: - 'middleware:env'`.

Сборку всех платформ можно задать в `/.smart-builder/main/main.yaml` в задаче `default`, тогда она выполнится при 
указании команды `smart-builder` без параметров или указания платформы.

```yaml
example:
  autocomplete: false # нужно указывать если не нужно чтобы эта задача попадала в автокомплит консоли
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

Список всех команд с примерами синтаксиса

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
  - shell.Sh: [ 'ls', '-1', cwd: 'dist' ]
  - shell.Sh: [ 'sudo', 'modprobe', 'kvm' ]
  - console.Log: [ 'test' ]
  - console.Dir: [ 'test' ]
  - download.File: [ 'https://site.com/archive.tar.gz', 'dist/archive.tar.gz' ]
  - download.Png: [ 'https://site.com/image.png', 'assets/splash.png' 'inside', '100' ] # 'contain', 'cover', 'fill', 'inside', 'outside'
  - download.Jpeg: [ 'https://site.com/image.jpeg', 'assets/splash.jpeg', 'inside', '200', '100' ]

  # Примеры функциональных fn.* команд для вычисления значений 
  - shell.Echo: [ 'Branch:', { fn.Git: [ 'rev-parse', '--abbrev-ref', 'HEAD', cwd: 'webos' ] } ]
  - shell.Echo: [ 'Branch:', { fn.Sh: [ 'git', 'rev-parse', '--abbrev-ref', 'HEAD', cwd: 'webos' ] }, cwd: 'webos' ]
  - shell.Echo: [ 'Branch:', { fn.GitFindBranch: [ env.SB_INPUT, cwd: 'webos' ] }, cwd: 'webos' ]
  - shell.Echo: [ 'App Id:', { fn.Xml: [ 'tizen/build/config.xml', [ 'widget', 'tizen:application', '0', '$', 'id' ] ] } ]
  - shell.Echo: [ 'App Name:', { fn.Json: [ 'app.json', [ 'name' ] ] } ]
  - shell.Echo: [ 'App Name:', { fn.Yaml: [ 'app.yaml', [ 'name' ] ] } ]
  - shell.Echo: [ 'Debug Mode:', { fn.If: [ env.DEBUG, 'yes', 'no' ] } ]
```