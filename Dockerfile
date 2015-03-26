FROM node:0.12

WORKDIR /home/pencilcode

# Install prerequistes
RUN npm install -g grunt-cli

# Install npm modules
ADD package.json /home/pencilcode/package.json
RUN npm install

ADD . /home/pencilcode/

EXPOSE 8008

CMD ["/usr/local/bin/grunt", "devserver"]

