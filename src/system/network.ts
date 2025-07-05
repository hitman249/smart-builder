import Utils from '../helpers/utils';
import _ from 'lodash';
import * as cookieParser from 'cookie';
import fetch, {type RequestInit, type Response} from 'node-fetch';
import fs from 'fs';
import path from 'path';
import process from 'process';
import {Progress} from "../fs/file-system";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

type KeyValue = {[key: string]: string};
type KeyValueAny = {[key: string]: any};

export default class Network {
  private static instance: Network;

  constructor() {
    if (Network.instance) {
      return Network.instance;
    }

    Network.instance = this;
    return Network.instance;
  }

  private readonly fileSettings: KeyValueAny = {
    flags: 'w',
    encoding: 'utf8',
    fd: null,
    mode: 0o755,
    autoClose: false,
  };

  private readonly options: RequestInit = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/71.0.3578.80 Chrome/71.0.3578.80 Safari/537.36',
    },
  };

  public async init(): Promise<any> {
  }

  private cookieParse(cookie: string | string[]): KeyValue {
    let result: KeyValue = {};

    if (Array.isArray(cookie)) {
      _.forEach(cookie, (line: string) => {
        result = Object.assign(result, cookieParser.parse(line));
      });

      return result;
    }

    return cookieParser.parse(cookie);
  }

  public cookieStringify(cookie: KeyValue): string {
    return _.map(cookie, (value: string, name: string) => cookieParser.serialize(name, value)).join('; ');
  }

  public headersParse(headers: KeyValue): KeyValue {
    const result: KeyValue = {};

    _.forEach(headers, (value: string, key: string) => {
      result[key] = value;
    });

    return result;
  }

  public async get(url: string): Promise<string> {
    return fetch(url, this.options).then((response: Response) => response.text());
  }

  public async getJSON(url: string): Promise<any> {
    return fetch(url, this.options).then((response: Response) => response.json());
  }

  public async download(url: string, filepath: string, progress?: (value: Progress) => void): Promise<void> {
    return fetch(url, this.options)
      .then((response: Response) => {
        const contentLength: number = Utils.toInt(response.headers.get('content-length'));
        let downloadedLength: number = 0;

        progress?.({
          success: false,
          progress: 0,
          totalBytes: contentLength,
          transferredBytes: downloadedLength,
          totalBytesFormatted: Utils.convertBytes(0),
          transferredBytesFormatted: Utils.convertBytes(0),
          path: url,
          name: path.basename(url),
          itemsComplete: 1,
          itemsCount: 1,
          event: 'download',
        });

        return new Promise((resolve: () => void, reject: () => void) => {
          let success: number = 0;
          const onSuccess: () => void = () => {
            success++;

            if (success > 1) {
              resolve();
            }
          };

          const fileStream: fs.WriteStream = fs.createWriteStream(
            filepath, {mode: this.fileSettings.mode, autoClose: true},
          );
          fileStream.on('error', reject);
          fileStream.on('finish', onSuccess);

          response.body.pipe(fileStream);
          response.body.on('end', () => {
            progress?.(Utils.getFullProgress('download'));
            onSuccess();
          });
          response.body.on('error', () => {
            progress?.(Utils.getFullProgress('download'));
            reject();
          });

          if (contentLength > 0) {
            response.body.on('data', (chunk: Buffer) => {
              downloadedLength += chunk.byteLength;

              progress?.({
                success: false,
                progress: 100 / contentLength * downloadedLength,
                totalBytes: contentLength,
                transferredBytes: downloadedLength,
                totalBytesFormatted: Utils.convertBytes(contentLength),
                transferredBytesFormatted: Utils.convertBytes(downloadedLength),
                path: url,
                name: path.basename(url),
                itemsComplete: 1,
                itemsCount: 1,
                event: 'download',
              });
            });
          }
        });
      });
  }
}