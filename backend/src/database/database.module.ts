import { Module, Logger } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('DatabaseModule');

        return {
          uri: configService.get<string>('mongodbUri')!,
          // Don't block HTTP server startup while waiting for MongoDB.
          // The app will keep retrying the connection in the background.
          serverSelectionTimeoutMS: 5_000,
          heartbeatFrequencyMS: 10_000,
          connectionFactory: (connection: import('mongoose').Connection) => {
            connection.on('connected', () => {
              logger.log('MongoDB connected');
            });
            connection.on('error', (err: Error) => {
              logger.error(`MongoDB connection error: ${err.message}`);
            });
            connection.on('disconnected', () => {
              logger.warn('MongoDB disconnected — will retry');
            });
            return connection;
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
