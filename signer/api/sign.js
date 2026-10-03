import { handleSignRequest } from '../src/handler.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1kb'
    }
  }
};

export default handleSignRequest;
