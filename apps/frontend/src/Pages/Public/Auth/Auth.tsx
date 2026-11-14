import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Simple_Button from '../../../Components/Buttons/Simple_Button/Simple_Button';
import './Auth.scss';
import { useSignin } from '../../../Hooks/Auth/useSignin';
import Global_Input from '../../../Components/Inputs/Global_Input/Global_Input';

// Numa instalação self-host não há registo nem recuperação de password: as
// contas são criadas pelo admin, e quem se esquecer da password pede-lhe outra.
const Auth = () => {
  const { t } = useTranslation();
  const [rememberMe, setRememberMe] = useState(false);

  const {
    signInEmail,
    setSignInEmail,
    signInpassword,
    setSignInpassword,
    signin,
    loading: loginLoading,
  } = useSignin();

  return (
    <>
      <div className="Auth">
        <div className='Form_Auth'>
          <form
            onSubmit={e => {
              e.preventDefault();
              signin(rememberMe);
            }}
          >
            <div className='Title'>
              <span>{t('auth.Sign In')}</span>
              <span>{t('auth.Enter your email and password to sign in!')}</span>
            </div>
            <div className="Input_field">
              {/* Texto e não email: a conta criada na instalação entra como "admin" */}
              <Global_Input
                type="text"
                placeholder={t('auth.Email')}
                value={signInEmail}
                onChange={e => setSignInEmail(e.target.value)}
              />
            </div>
            <div className="Input_field">
              <Global_Input
                type="password"
                placeholder={t('auth.Password')}
                value={signInpassword}
                onChange={e => setSignInpassword(e.target.value)}
              />
            </div>
            <div className='Keep_login_or_recover_password'>
              <div>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                />
                <span>{t('auth.Keep me logged in')}</span>
              </div>
            </div>
            <div className="Button_Field">
              <Simple_Button
                type="submit"
                text={loginLoading ? t('auth.Loading') : t('auth.Login')}
                disabled={loginLoading}
              />
            </div>
          </form>
        </div>
        <div className="Info">
          <svg className='Info_Lines' viewBox='0 0 600 800' preserveAspectRatio='none' xmlns='http://www.w3.org/2000/svg'>
            <path className='Info_Line Info_Line_1' d='M-50,660 C 90,610 190,520 340,530 C 470,538 530,430 660,390' fill='none' stroke='var(--auth-page-info-line-color)' strokeWidth='1.5' strokeLinecap='round' />
            <path className='Info_Line Info_Line_2' d='M-50,740 C 110,700 240,630 380,635 C 510,640 570,520 660,470' fill='none' stroke='var(--auth-page-info-line-color)' strokeWidth='1.5' strokeLinecap='round' />
            <path className='Info_Line Info_Line_3' d='M-50,560 C 80,510 210,470 350,440 C 470,415 540,330 660,290' fill='none' stroke='var(--auth-page-info-line-color)' strokeWidth='2' strokeLinecap='round' />
            <path className='Info_Line Info_Line_4' d='M-50,460 C 100,430 220,380 360,360 C 480,343 520,250 660,190' fill='none' stroke='var(--auth-page-info-line-color)' strokeWidth='1' strokeLinecap='round' />
          </svg>
          <div className='Info_Content'>
            <div className='Info_Brand'>
              <span>Intri</span>
              <span>Stock</span>
            </div>
            <h1 className='Info_Title'>{t('auth.infoTitle')}</h1>
            <p className='Info_Subtitle'>{t('auth.infoSubtitle')}</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Auth;
