import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

// O JWT da sessão: o AuthUserModule emite-o no login e o UserModule volta a emiti-lo
// quando a pessoa muda a própria password (os outros tokens caem)
export const UserJwtModule = JwtModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    secret: config.get<string>('JWT_USER_SECRET'),
    signOptions: { expiresIn: '7d' },
  }),
});
