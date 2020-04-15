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
ARG mongo_db_connection_string
ENV MONGO_DB_CONNECTION_STRING=$mongo_db_connection_string
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
ARG infobip_url
ENV INFOBIP_URL=$infobip_url
ARG infobip_api_key
ENV INFOBIP_API_KEY=$infobip_api_key
ARG lcc_provider_code_prod
ENV LCC_PROVIDER_CODE_PROD=$lcc_provider_code_prod
ARG lcc_provider_code_staging
ENV LCC_PROVIDER_CODE_STAGING=$lcc_provider_code_staging
ARG lcc_toll_service_code_prod
ENV LCC_TOLL_SERVICE_CODE_PROD=$lcc_toll_service_code_prod
ARG lcc_toll_service_code_staging
ENV LCC_TOLL_SERVICE_CODE_STAGING=$lcc_toll_service_code_staging
COPY ./package.json /var/cashtokenussd/
RUN npm install
WORKDIR /var/cashtokenussd/
COPY . /var/cashtokenussd
EXPOSE ${port}
CMD ["npm","start"]