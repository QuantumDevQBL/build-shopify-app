require('isomorphic-fetch');
const dotenv = require('dotenv');
const Koa = require('koa');
const next = require('next');
const { default: createShopifyAuth } = require('@shopify/koa-shopify-auth');
const { verifyRequest } = require('@shopify/koa-shopify-auth');
const session = require('koa-session');

dotenv.config();
//import  koa-shopify-graphql-proxy
const { default: graphQLProxy } = require('@shopify/koa-shopify-graphql-proxy');
//import koa-shopify-webhooks
const Router = require('koa-router');
const {receiveWebhook, registerWebhook} = require('@shopify/koa-shopify-webhooks');
//import API version
const { ApiVersion } = require('@shopify/koa-shopify-graphql-proxy');
//add getSubscriptionUrl file
const getSubscriptionUrl = require('./server/getSubscriptionUrl');


const port = parseInt(process.env.PORT, 10) || 3000;
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const { SHOPIFY_API_SECRET_KEY, SHOPIFY_API_KEY, HOST } = process.env;

//Add the app to your server file


app.prepare().then(() => {
    //Add your routing middleware and koa server
    const server = new Koa();
    //instatiate the router
    const router = new Router();
    server.use(session({ secure: true, sameSite: 'none' }, server));
    server.keys = [SHOPIFY_API_SECRET_KEY];
    //Add the createShopifyAuth and verifyRequest middleware
    server.use(
        createShopifyAuth({
          apiKey: SHOPIFY_API_KEY,
          secret: SHOPIFY_API_SECRET_KEY,
          scopes: ['read_products', 'write_products'],
          async afterAuth(ctx) {
            const { shop, accessToken } = ctx.session;
            ctx.cookies.set('shopOrigin', shop, {
                httpOnly: false,
                secure: true,
                sameSite: 'none'
              });

              //register a webhook for product creation
              const registration = await registerWebhook({
                address: `${HOST}/webhooks/products/create`,
                topic: 'PRODUCTS_CREATE',
                accessToken,
                shop,
                apiVersion: ApiVersion.October20
              });
           
              if (registration.success) {
                console.log('Successfully registered webhook!');
              } else {
                console.log('Failed to register webhook', registration.result);
              }

            await getSubscriptionUrl(ctx, accessToken, shop);
          },
        }),
      );
    
      server.use(graphQLProxy({version: ApiVersion.October20}));
      server.use(verifyRequest());

    server.use(async (ctx) => {
      await handle(ctx.req, ctx.res);
      ctx.respond = false;
      ctx.res.statusCode = 200;
      return
    });

    //Set your app to run on port 3000
     server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });

});


