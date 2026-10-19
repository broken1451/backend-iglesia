import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { ConfigModule, ConfigService } from '@nestjs/config';
import conf from './conf/config.js';
import { MongooseModule } from '@nestjs/mongoose';
import { IglesiasModule } from './iglesias/iglesias.module.js';

@Module({
  imports: [
    AuthModule,
    ConfigModule.forRoot({
      load: [conf],
      isGlobal: true
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        if (!configService.get('mongo.url') && !process.env.URI) {
          throw new Error('MongoDB URI is not defined in the environment variables or config file');
        }

        let uri = '';
        let dbName = '';
        if (process.env.STAGE === 'dev') {
          uri = String(configService.get('mongo.url')) 
          dbName = String(configService.get('mongo.dbName'))
        } else if (process.env.STAGE === 'production') {
          uri = String(process.env.URI)
          dbName = String(process.env.DBNAME)
        }
        console.log('MongoDB URI:', uri);
        console.log('MongoDB Database Name:', dbName);
        return {
          uri,
          dbName
        }
      },
    }),
    IglesiasModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
