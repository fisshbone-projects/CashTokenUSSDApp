FROM node:10.16-alpine
RUN apk update && apk add --no-cache bash
RUN apk add --no-cache git
WORKDIR /var/cashtokenussd/
ARG node_env
ENV NODE_ENV=$node_env
ARG port=3000
ENV PORT=$port
ARG redis_env
ENV REDIS_ENV=$redis_env
ARG redis_port
ENV REDIS_PORT=$redis_port
ARG redis_host
ENV REDIS_HOST=$redis_host
ARG redis_auth
ENV REDIS_AUTH=$redis_auth
ARG fela_base_url_prod
ENV FELA_BASE_URL_PROD=$fela_base_url_prod
ARG fela_base_url_staging
ENV FELA_BASE_URL_STAGING=$fela_base_url_staging
ARG fela_auth_bearer_staging
ENV FELA_AUTH_BEARER_STAGING=$fela_auth_bearer_staging
ARG fela_auth_bearer_prod
ENV FELA_AUTH_BEARER_PROD=$fela_auth_bearer_prod
ARG fela_this_source
ENV FELA_THIS_SOURCE=$fela_this_source
ARG redis_expire_api_info
ENV REDIS_EXPIRE_API_INFO=$redis_expire_api_info
COPY ./package.json /var/cashtokenussd/
RUN npm install
WORKDIR /var/cashtokenussd/
COPY . /var/cashtokenussd
EXPOSE ${port}
CMD ["npm","start"]