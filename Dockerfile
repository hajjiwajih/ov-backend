FROM node:12

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package.json /usr/src/app/

RUN npm install


# Bundle app source
COPY . /usr/src/app/

ENV NODE_ENV=production
EXPOSE 3500
CMD [ "npm", "start" ]
