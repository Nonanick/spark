import type { SecureContextOptions, TlsOptions } from "node:tls";

export const HttpConfiguration: THttpConfiguration = {
  server: {
    host: '127.0.0.1',
    port: 4001
  },
  route: {
    body: {
      maxBodySize: 1024 * 1024 * 50,
    },
    headers: {
      contentType : [
        'application/json',
        'text/plain',
        'application/x-www-form-urlencoded',
        'multipart/form-data'
      ]
    },
    files: {
      acceptMimes: '*/*',
      maxFileSize: 5 * 1024 * 1024,
      maxTotalSize: 1024 * 1024 * 50,
      minimunFileSize: 128,
      maxFiles : 10,
    },
  }
}

export type THttpConfiguration = {
  server: {
    host: string;
    port: number;
    ssl?: TlsOptions & SecureContextOptions;
  };
  route: {
    body: {
      maxBodySize: number;
    };
    files: {
      maxFileSize: number;
      maxTotalSize: number;
      acceptMimes: string | string[];
      minimunFileSize: number;
      maxFiles : number;
    };
    headers: {
      contentType: string | string[];
    };
  }
}