export class AuthenticationService {

  login(credentials: IAuthenticationCredentials) {
    if (credentials.username === 'admin' && credentials.password === 'admin')
      return 'OK_YOU_ARE_LOGGED_IN';
    else
      return false;
  }

  checkAccessToken(token : string) {
    return token === 'OK_YOU_ARE_LOGGED_IN';
  }

}

interface IAuthenticationCredentials {
  username: string;
  password: string;
}

