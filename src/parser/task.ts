import process from "process";
import type {App} from "../app";
import type Step from "./step";

export default class Task {
  private static index: number = 0;
  private readonly app: App;
  private readonly doc: any;
  private readonly target: string;

  constructor(app: App, doc: any, target: string) {
    this.app = app;
    this.doc = doc;
    this.target = target;
  }

  public async init(): Promise<void> {
    if (this.doc.env) {
      for (const field of Object.keys(this.doc.env)) {
        this.app.getEnv().hydrate(field, await this.app.hydrateData(this.doc.env[field]));
      }
    }
  }

  public async run(): Promise<void> {
    console.log(`\n[${++Task.index}][${this.target}] ${this.doc.desc || ''}`);

    if (this.doc.steps) {
      for (const value of this.doc.steps) {
        const step: Step = this.app.createStep(value);

        try {
          await step.run();
        } catch (e) {
          console.log(`Step returned the error code:`);
          console.dir(await step.getRule(), {depth: 3});
          process.exit(1);
        }
      }
    }
  }

  public checkEnvFieldsRequired(): boolean {
    if (this.doc.required) {
      for (const field of this.doc.required) {
        if (!this.app.getEnv().isExist(field)) {
          return false;
        }
      }
    }

    return true;
  }
}