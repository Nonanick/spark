export const LoggerConfiguration = {
  targets : [
    {
      target : 'pino/file',
      options : {
        destination : './application.log'
      },
      level : 'trace'
    },
    {
      target : 'pino/file',
      options : {
        destination : './errors.log'
      },
      level : 'error'
    }
  ],
};

export type TLoggerConfiguration = typeof LoggerConfiguration;