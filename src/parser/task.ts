import {App} from "../app";
import type Step from "./step";

export default class Task {
  private readonly app: App;
  private readonly doc: any;

  constructor(app: App, doc: any) {
    this.app = app;
    this.doc = doc;
  }

  public async init(): Promise<void> {
    if (this.doc.env) {
      for (const field of Object.keys(this.doc.env)) {
        this.app.getEnv().hydrate(field, await this.app.hydrateData(this.doc.env[field]));
      }
    }
  }

  public async run(): Promise<void> {
    if (this.doc.steps) {
      for (const value of this.doc.steps) {
        const step: Step = this.app.createStep(value);
        await step.run();
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