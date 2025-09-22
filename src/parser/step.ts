import type {App} from "../app";
import FileSystem from "../fs/file-system";
import Utils from "../helpers/utils";
import _ from "lodash";
import process from "process";
import Network from "../system/network";
import sharp from "sharp";
import type {ResizeOptions, Sharp} from "sharp";
import {Client} from "basic-ftp";

type RuleType = {
  rule: string,
  value: any,
}

export default class Step {
  private readonly app: App;
  private readonly data: any;
  private readonly fs: FileSystem;

  constructor(app: App, data: any) {
    this.app = app;
    this.data = data;
    this.fs = new FileSystem();
  }

  public get rootPath(): string {
    return this.app.getRootPath();
  }

  public get debug(): boolean {
    return this.app.isDebug();
  }

  public async getRule(): Promise<RuleType> {
    const hydrateData: any = await this.app.hydrateData(this.data);

    if (_.isString(hydrateData)) {
      return;
    }

    const rule: string = Object.keys(hydrateData)[0];
    const value: any = hydrateData[rule];

    return {rule, value};
  }

  public async run(): Promise<void> {
    const hydrateData: any = await this.app.hydrateData(this.data);

    if (_.isString(hydrateData)) {
      return this.app.run(hydrateData);
    }

    const rule: string = Object.keys(hydrateData)[0];
    const value: any = hydrateData[rule];

    switch (rule) {
      case 'switch':
        return this.fnSwitch(value);
      case 'shell.Exit':
        return this.fnExit();
      case 'load.Env':
        return this.loadEnv(value);
      case 'edit.Json':
        return this.editJson(value);
      case 'edit.Xml':
        return this.editXml(value);
      case 'edit.Yaml':
        return this.editYaml(value);
      case 'edit.Ini':
        return this.editIni(value);
      case 'edit.Text':
        return this.editText(value);
      case 'edit.Replace':
        return this.editReplace(value);
      case 'shell.Echo':
        return this.anyFn(['echo'], value);
      case 'shell.Npm':
        return this.anyFn(['npm'], value);
      case 'shell.Yarn':
        return this.anyFn(['yarn'], value);
      case 'shell.Sh':
        return this.anyFn([], value);
      case 'shell.Gulp':
        return this.anyFn(['npx', 'gulp'], value);
      case 'shell.Git':
        return this.anyFn(['git'], value);
      case 'shell.git.Pull':
        return this.anyFn(
          ['git', 'pull', 'origin', await this.fetchAnyFn(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], this.onlyCwd(value))],
          this.onlyCwd(value)
        );
      case 'shell.git.ResetSubmodules':
        await this.anyFn(['git', 'submodule', 'deinit', '-f', '.'], this.onlyCwd(value));
        await this.anyFn(['git', 'submodule', 'update', '--init', '--recursive', '--checkout'], this.onlyCwd(value));
        return;
      case 'shell.git.PullSubmodules':
        return this.anyFn(['git', 'submodule', 'update', '--init', '--recursive', '--remote', '--checkout'], this.onlyCwd(value));
      case 'shell.git.SetSubmoduleBranch':
        return this.anyFn(['git', 'submodule', 'set-branch', '-b', value[0], value[1]], this.onlyCwd(value));
      case 'open.Url':
        return this.openUrl(value);
      case 'ares.Inspect':
        return this.anyFn(['ares-inspect'], value);
      case 'ares.Install':
        return this.anyFn(['ares-install'], value);
      case 'ares.Launch':
        return this.anyFn(['ares-launch'], value);
      case 'tizen.Install':
        return this.tizenInstall(value);
      case 'tizen.Package':
        return this.tizenPackage(value);
      case 'tizen.Run':
        return this.tizenRun(value);
      case 'tizen.Stop':
        return this.tizenStop(value);
      case 'tizen.Inspect':
        return this.tizenInspect(value);
      case 'tizen.Remove':
        return this.tizenRemove(value);
      case 'tizen.EmulatorStart':
        return this.tizenEmulatorStart(value);
      case 'vbox.Start':
        return this.anyFn(['VBoxManage', 'startvm', Utils.first(value)], []);
      case 'vbox.Pause':
        return this.anyFn(['VBoxManage', 'controlvm', Utils.first(value), 'pause'], []);
      case 'vbox.Resume':
        return this.anyFn(['VBoxManage', 'controlvm', Utils.first(value), 'resume'], []);
      case 'shell.Clean':
        return this.shellClean(value);
      case 'shell.Copy':
        return this.shellCopy(value);
      case 'shell.Mkdir':
        return this.shellMkdir(value);
      case 'console.Log':
        return this.consoleLog(value);
      case 'console.Dir':
        return this.consoleDir(value);
      case 'download.File':
        return this.downloadFile(value);
      case 'download.Png':
        return this.downloadImage(value, false);
      case 'download.Jpeg':
        return this.downloadImage(value, true);
      case 'upload.Ftp':
        return this.uploadFtp(value);
    }
  }

  private async fnSwitch(data: any): Promise<void> {
    const options: any = this.app.getOptions(data);
    const input: any = options.data.value;
    let item: any = (options.data.cases as any[] || []).find((item: any): boolean => input === item.case);

    if (!item) {
      item = (options.data.cases as any[] || []).find((item: any): boolean => 'default' === item.case);
    }

    if (!item) {
      return;
    }

    if (this.debug) {
      console.log('Step.fnSwitch');
      console.dir(item, {depth: 10});
      return;
    }

    if (item.steps) {
      for (const value of item.steps) {
        const step: Step = this.app.createStep(value);
        await step.run();
      }
    }
  }

  private async fnExit(): Promise<void> {
    process.exit(0);
  }

  private async loadEnv(data: any): Promise<void> {
    const options: any = this.app.getOptions(data);
    let path: string = Utils.first(options.data);
    path = Utils.isUrl(path) ? path : this.app.getFullPath(path, options.cwd);
    const env: string = await this.fs.readJsonFile(path);
    await this.app.getEnv().loadEnv(env);
  }

  private async editJson(data: any): Promise<void> {
    const options: any = this.app.getOptions(await this.app.hydrateData(data));
    const file: string = this.app.getFullPath(Utils.first(options.data), options.cwd);
    const path: string = options.data[1];
    const value: string = options.data[2];

    if (this.debug) {
      console.log('Step.editJson');
      console.dir({file, path, value}, {depth: 10});
      return;
    }

    const content: any = (await this.fs.exists(file)) ? await this.fs.readJsonFile(file) : {};
    await this.fs.saveJsonFile(file, _.set(content, path, value));
  }

  private async editXml(data: any): Promise<void> {
    const options: any = this.app.getOptions(await this.app.hydrateData(data));
    const file: string = this.app.getFullPath(Utils.first(options.data), options.cwd);
    const path: string = options.data[1];
    const value: string = options.data[2];

    if (this.debug) {
      console.log('Step.editXml');
      console.dir({file, path, value}, {depth: 10});
      return;
    }

    const content: any = (await this.fs.exists(file)) ? await this.fs.readXmlFile(file) : {};
    await this.fs.saveXmlFile(file, _.set(content, path, value));
  }

  private async editYaml(data: any): Promise<void> {
    const options: any = this.app.getOptions(await this.app.hydrateData(data));
    const file: string = this.app.getFullPath(Utils.first(options.data), options.cwd);
    const path: string = options.data[1];
    const value: string = options.data[2];

    if (this.debug) {
      console.log('Step.editYaml');
      console.dir({file, path, value}, {depth: 10});
      return;
    }

    const content: any = (await this.fs.exists(file)) ? await this.fs.readYamlFile(file) : {};
    await this.fs.saveYamlFile(file, _.set(content, path, value));
  }

  private async editIni(data: any): Promise<void> {
    const options: any = this.app.getOptions(await this.app.hydrateData(data));
    const file: string = this.app.getFullPath(Utils.first(options.data), options.cwd);
    const path: string = options.data[1];
    const value: string = options.data[2];

    if (this.debug) {
      console.log('Step.editIni');
      console.dir({file, path, value}, {depth: 10});
      return;
    }

    const content: any = (await this.fs.exists(file)) ? await this.fs.readIniFile(file) : {};
    await this.fs.saveIniFile(file, _.set(content, path, value));
  }

  private async editText(data: any): Promise<void> {
    const options: any = this.app.getOptions(await this.app.hydrateData(data));
    const file: string = this.app.getFullPath(Utils.first(options.data), options.cwd);

    if (this.debug) {
      console.log('Step.editText');
      console.log(options.data.slice(1).join('\n'));
      return;
    }

    await this.fs.saveFile(file, options.data.slice(1).join('\n'));
  }

  private async editReplace(data: any): Promise<void> {
    const options: any = this.app.getOptions(await this.app.hydrateData(data));
    const file: string = this.app.getFullPath(Utils.first(options.data), options.cwd);
    const find: string = options.data[1];
    const replace: string = options.data[2];

    if (this.debug) {
      console.log('Step.editReplace');
      console.dir({file, find, replace}, {depth: 10});
      return;
    }

    if (!await this.fs.exists(file)) {
      return;
    }

    const plainText: string = await this.fs.readFile(file);
    await this.fs.saveFile(file, plainText.split(find).join(replace));
  }

  private async openUrl(data: any): Promise<void> {
    const options: any = this.app.getOptions(data);
    const path: string = Utils.first(options.data);

    if (this.debug) {
      console.log('Step.openUrl:', path);
      return;
    }

    await this.app.getCommand().watch(['xdg-open', path], options.cwd).wait();
  }

  private async tizenInstall(data: any): Promise<void> {
    const options: any = this.app.getOptions(data);
    const filename: string = options.data[0];
    const target: string = options.data[1];
    const cmd: string[] = [
      `${process.env.HOME}/tizen-studio/tools/ide/bin/tizen`,
      'install', '-n', filename, '-t', target
    ];

    if (this.debug) {
      console.log('Step.tizenInstall:');
      console.log(this.app.getCommand().createCmd(cmd, options.cwd));
    } else {
      await this.app.getCommand().watch(cmd, options.cwd).wait();
    }
  }

  private async tizenPackage(data: any): Promise<void> {
    const options: any = this.app.getOptions(data);
    const cert: string = options.data[0];
    const cmd: string[] = [
      `${process.env.HOME}/tizen-studio/tools/ide/bin/tizen`,
      'package', '-t', 'wgt', '-s', cert, '--', './'
    ];

    if (this.debug) {
      console.log('Step.tizenPackage:');
      console.log(this.app.getCommand().createCmd(cmd, options.cwd));
    } else {
      await this.app.getCommand().watch(cmd, options.cwd).wait();
    }
  }

  private async tizenRun(data: any): Promise<void> {
    const options: any = this.app.getOptions(data);
    const packageId: string = options.data[0];
    const target: string = options.data[1];
    const cmd: string[] = [
      `${process.env.HOME}/tizen-studio/tools/ide/bin/tizen`,
      'run', '-p', packageId, '-t', target
    ];

    if (this.debug) {
      console.log('Step.tizenRun:');
      console.log(this.app.getCommand().createCmd(cmd, options.cwd));
    } else {
      await this.app.getCommand().watch(cmd, options.cwd).wait();
    }
  }

  private async tizenInspect(data: any): Promise<void> {
    const options: any = this.app.getOptions(data);
    const packageId: string = options.data[0];
    const DEBUG_PORT: RegExp = new RegExp(/(port(.*):\s+\d+)/g);
    const cmd: string[] = [
      `${process.env.HOME}/tizen-studio/tools/sdb`, 'shell', '0', 'debug', packageId
    ];

    let launchResult: string;

    if (this.debug) {
      console.log('Step.tizenInspect:');
      console.log(this.app.getCommand().createCmd(cmd, options.cwd));
      return;
    } else {
      launchResult = await this.app.getCommand().exec(cmd, options.cwd);
    }

    console.log(launchResult);

    const port: string = _.trim(launchResult.match(DEBUG_PORT)[0].split(':')[1]);

    if (port) {
      await Utils.sleep(3000);

      try {
        await this.app.getCommand().watch([
          `${process.env.HOME}/tizen-studio/tools/sdb`, 'forward', '--remove', `tcp:${port}`
        ], options.cwd).wait();
      } catch (e) {
      }

      await this.app.getCommand().watch([
        `${process.env.HOME}/tizen-studio/tools/sdb`, 'forward', `tcp:${port}`, `tcp:${port}`
      ], options.cwd).wait();

      const doc: any = await this.app.getNetwork().getJSON(`http://localhost:${port}/json`);
      const postfix: string = doc?.[0]?.['devtoolsFrontendUrl'];

      console.log(`Debug URL:`);
      console.log(`http://localhost:${port}${postfix}`);
    } else {
      console.log(`Failed to start the application in debugging mode.`);
    }
  }

  private async tizenStop(data: any): Promise<void> {
    const options: any = this.app.getOptions(data);
    const packageId: string = options.data[0];
    const cmd: string[] = [`${process.env.HOME}/tizen-studio/tools/sdb`, 'shell', '0', 'was_kill', packageId];

    if (this.debug) {
      console.log('Step.tizenStop:');
      console.log(this.app.getCommand().createCmd(cmd, options.cwd));
    } else {
      await this.app.getCommand().watch(cmd, options.cwd).wait();
    }
  }

  private async tizenRemove(data: any): Promise<void> {
    const options: any = this.app.getOptions(data);
    const packageId: string = options.data[0];
    const target: string = options.data[1];
    const cmd: string[] = [
      `${process.env.HOME}/tizen-studio/tools/ide/bin/tizen`,
      'uninstall', '-p', packageId, '-t', target
    ];

    if (this.debug) {
      console.log('Step.tizenRemove:');
      console.log(this.app.getCommand().createCmd(cmd, options.cwd));
    } else {
      await this.app.getCommand().watch(cmd, options.cwd).wait();
    }
  }

  private async tizenEmulatorStart(data: any): Promise<void> {
    const options: any = this.app.getOptions(data);
    const platform: string = options.data[0];
    const target: string = options.data[1];

    const cmd: string[] = [
      `${process.env.HOME}/tizen-studio/platforms/${platform}/tv-samsung/emulator/bin/emulator.sh`,
      '--conf',
      `${process.env.HOME}/tizen-studio-data/emulator/vms/${target}/vm_launch.conf`,
      '-j',
      `${process.env.HOME}/tizen-studio/jdk/bin/java`,
    ];

    if (this.debug) {
      console.log('Step.tizenEmulatorStart:');
      console.log(this.app.getCommand().createCmd(cmd, options.cwd));
    } else {
      await this.app.getCommand().watch(cmd, options.cwd).wait();
    }
  }

  private async shellClean(data: any): Promise<void> {
    const options: any = this.app.getOptions(data);
    const path: string = this.app.getFullPath(Utils.first(options.data), options.cwd);

    if (this.debug) {
      console.log('Step.shellClean:', path);
      return;
    }

    if (Utils.first(options.data) && _.trim(this.rootPath, '\\/') !== _.trim(path, '\\/')) {
      await this.fs.rm(path);
    }
  }

  private async shellCopy(data: any): Promise<void> {
    const options: any = this.app.getOptions(data);
    const from: string = this.app.getFullPath(options.data[0], options.cwd);
    const to: string = this.app.getFullPath(options.data[1], options.cwd);

    if (this.debug) {
      console.log('Step.shellCopy:', {from, to});
      return;
    }

    if (options.data[0] && _.trim(this.rootPath, '\\/') !== _.trim(from, '\\/') &&
      options.data[1] && _.trim(this.rootPath, '\\/') !== _.trim(to, '\\/')) {
      await this.fs.cp(from, to);
    }
  }

  private async shellMkdir(data: any): Promise<void> {
    const options: any = this.app.getOptions(data);
    const path: string = this.app.getFullPath(Utils.first(options.data), options.cwd);

    if (this.debug) {
      console.log('Step.shellMkdir: ', path);
      return;
    }

    if (path && _.trim(this.rootPath, '\\/') !== _.trim(path, '\\/')) {
      await this.fs.mkdir(path);
    }
  }

  private async consoleLog(data: any): Promise<void> {
    console.log(..._.castArray(data));
  }

  private async consoleDir(data: any): Promise<void> {
    console.dir(..._.castArray(data), {depth: 5});
  }

  private async downloadFile(data: any): Promise<void> {
    const options: any = this.app.getOptions(data);
    const url: string = options.data[0];
    const out: string = options.data[1];

    if (this.debug) {
      console.log('Step.downloadFile: ', {url, out});
      return;
    }

    if (!url) {
      return Promise.reject(`Error download file from "${url}".`);
    }

    const network: Network = new Network();
    await network.download(url, this.app.getFullPath(out, options.cwd));
  }

  private async downloadImage(data: any, isJpeg: boolean = false): Promise<void> {
    const options: any = this.app.getOptions(data);
    const url: string = Utils.isUrl(options.data[0]) ? options.data[0] : this.app.getFullPath(options.data[0], options.cwd);
    const out: string = this.app.getFullPath(options.data[1], options.cwd);

    if (this.debug) {
      console.log('Step.downloadImage: ', {url, out});
      return;
    }

    const fits: string[] = ['contain', 'cover', 'fill', 'inside', 'outside'];

    let fit: ResizeOptions['fit'];
    let width: number;
    let height: number;

    if (data[2] && -1 === fits.indexOf(data[2])) {
      fit = 'inside';
      width = Utils.toInt(data[2]);
      height = Utils.toInt(data[3]) ? Utils.toInt(data[3]) : width;
    } else {
      fit = data[2];
      width = Utils.toInt(data[3]);
      height = Utils.toInt(data[4]) ? Utils.toInt(data[4]) : width;
    }

    if (!url) {
      console.log(`Error download file from "${url}".`);
      return;
    }

    if (!width) {
      console.log(`Error file from "${url}". There is no width: "${width}". `, );
      return;
    }

    if (!Utils.isUrl(url)) {
      if (await this.fs.exists(url)) {
        if (url !== out) {
          if (await this.fs.exists(out)) {
            await this.fs.rm(out);
          }

          await this.fs.cp(url, out);
        }
      } else {
        console.log(`Error file from "${url}". File not found.`, );
        return;
      }
    } else {
      const network: Network = new Network();

      try {
        await network.download(url, out);
      } catch (e) {
        console.log(`Error file from "${url}". Failed to download the file.`, );
        return;
      }
    }

    if (!await this.fs.exists(out)) {
      console.log(`Error file from "${url}". Failed to download the file.`, );
      return;
    }

    let resize: Sharp = sharp(out).resize({fit, width, height});
    const buffer: Buffer = await (isJpeg ? resize.jpeg() : resize.png()).toBuffer();

    if (await this.fs.exists(out)) {
      await this.fs.rm(out);
    }

    await this.fs.saveFile(out, buffer);
  }

  private async uploadFtp(data: any): Promise<void> {
    const fileIn: string = this.app.getFullPath(data?.PATH_IN);
    const fileOut: string = `/${_.trim(data?.PATH_OUT, '/')}`;
    const dirOut: string = `/${_.trim(this.fs.dirname(fileOut), '/')}`;

    if (this.debug) {
      console.log('Step.uploadFtp: ', {in: fileIn, out: fileOut});
      console.dir(data, {depth: 2});
      return;
    }

    if (
      !data?.PATH_IN
      || _.trim(this.app.getRootPath(), '\\/') === _.trim(fileIn, '\\/')
      || !data?.PATH_OUT
      || !data?.HOST
    ) {
      return;
    }

    if (!await this.fs.exists(fileIn)) {
      console.log(`File not found to upload on ftp:`, fileIn);
      return;
    }

    const client: Client = new Client();
    client.ftp.verbose = Utils.isTrue(data.VERBOSE);

    try {
      await client.access({
        host: data.HOST,
        user: data.USER || '',
        password: data.PASSWORD || '',
        secure: Utils.isTrue(data.SECURE),
        port: data?.PORT || 21,
      });

      if (dirOut) {
        try {
          await client.ensureDir(dirOut);
        } catch (e) {}
      }

      try {
        await client.remove(fileIn);
      } catch (e) {}

      try {
        console.log(`Upload on ftp:`, fileOut);
        await client.uploadFrom(fileIn, fileOut);
      } catch (e) {}
    } catch(err) {
      console.log(err);
    }

    try {
      client.close();
    } catch (e) {}
  }

  private async anyFn(cmd: string[], data: any): Promise<void> {
    const options: any = this.app.getOptions(data);

    if (this.debug) {
      console.log('Step.any: ');
      console.log(this.app.getCommand().createCmd([...cmd, ...options.data], options.cwd));
      return;
    }

    await this.app.getCommand().watch([...cmd, ...options.data], options.cwd).wait();
  }

  private async fetchAnyFn(cmd: any[], data: any): Promise<string> {
    const options: any = this.app.getOptions(data);
    return await this.app.getCommand().exec([...cmd, ...options.data], options.cwd);
  }

  private onlyCwd(data: any): [{cwd: string}] {
    const options: any = this.app.getOptions(data);
    return [{cwd: options.cwd}];
  }
}