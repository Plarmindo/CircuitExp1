import winston from 'winston';
import { PluginKitConfig } from '../types/config';

export class LoggerService {
  static createLogger(config: PluginKitConfig['logging']): winston.Logger {
    const transports: winston.transport[] = [];
    
    // Console transport
    if (config.console.enabled) {
      transports.push(
        new winston.transports.Console({
          level: config.level,
          format: winston.format.combine(
            winston.format.colorize({ all: config.console.colorize }),
            winston.format.timestamp(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
              return `${timestamp} [${level}]: ${message} ${metaStr}`;
            })
          )
        })
      );
    }
    
    // File transport
    if (config.file.enabled) {
      transports.push(
        new winston.transports.File({
          filename: config.file.path,
          level: config.level,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
          maxsize: this.parseFileSize(config.file.maxSize),
          maxFiles: config.file.maxFiles
        })
      );
    }
    
    return winston.createLogger({
      level: config.level,
      format: winston.format.json(),
      transports,
      exitOnError: false
    });
  }

  private static parseFileSize(size: string): number {
    const units = {
      B: 1,
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024
    };
    
    const match = size.match(/^(\d+(?:\.\d+)?)\s*([KMG]?B)$/i);
    if (!match) return 10 * 1024 * 1024; // Default 10MB
    
    const [, value, unit] = match;
    return parseFloat(value) * (units[unit.toUpperCase() as keyof typeof units] || 1);
  }
}