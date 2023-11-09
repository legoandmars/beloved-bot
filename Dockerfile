FROM node:lts-buster as makesweet-build-runner

# this is a very chubby docker image, it could be stripped down a lot.

RUN \
  apt-get update; \
  apt-get install -y build-essential

RUN \
  apt-get update; \
  apt-get install -y libgd-dev libzzip-dev libopencv-highgui-dev

RUN \
  cd tmp; \
  apt-get update; \
  apt-get install -y cmake wget; \
  wget https://github.com/robotology/yarp/archive/v2.3.72.tar.gz; \
  tar xzvf v2.3.72.tar.gz; \
  mkdir yarp; \
  cd yarp; \
  cmake -DSKIP_ACE=TRUE ../yarp-*; \
  make 

RUN \
  apt-get update; \
  apt-get install -y protobuf-compiler libprotobuf-dev

RUN \
  apt-get update; \
  apt-get install -y libopencv-videoio-dev

RUN \
  apt-get update; \
  apt-get install -y libjsoncpp-dev

COPY ./makesweet /makesweet/

RUN \
  cd /makesweet; \
  mkdir build; \
  cd build; \
  cmake -DUSE_OPENCV=ON -DUSE_DETAIL=ON -DYARP_DIR=/tmp/yarp ..; \
  make VERBOSE=1

## build runner
FROM node:lts-buster as build-runner

# Set temp directory
WORKDIR /tmp/app

# Move package.json
COPY package.json .

# Install dependencies
RUN npm install

# Move source files
COPY src ./src
COPY tsconfig.json .

# Build project
RUN npm run build

## production runner
FROM node:lts-buster as prod-runner

# install deps for makesweet
RUN \
  apt-get update; \
  apt-get install -y libgd-dev libzzip-dev libopencv-highgui-dev libopencv-videoio-dev protobuf-compiler libjsoncpp-dev

# install ffmpeg for mp4 -> gif conversion
RUN \
  apt-get install -y ffmpeg

# install necessary fonts
RUN \
  sed -i'.bak' 's/$/ contrib/' /etc/apt/sources.list; \
  apt-get update; \
  apt-get install -y ttf-mscorefonts-installer fontconfig

# install emoji font 
RUN \
  wget -P /app/resources/ https://github.com/PoomSmart/EmojiLibrary/releases/download/0.16.4/AppleColorEmoji@2x.ttf
  
# Set work directory
WORKDIR /app

RUN mkdir /app/images
# Copy package.json from build-runner
COPY --from=build-runner /tmp/app/package.json /app/package.json

# Get yarp from makesweet build
COPY --from=makesweet-build-runner /tmp/yarp/lib /usr/lib
RUN ldconfig

# Copy makesweet reanimator for image generation
COPY --from=makesweet-build-runner /makesweet/build/bin /app/makesweet

# Copy makesweet templates
COPY ./makesweet/templates /app/templates

# Copy resources
COPY ./resources /app/resources

# Install dependencies
RUN npm install --omit=dev

# Move build files
COPY --from=build-runner /tmp/app/build /app/build

# Start bot
CMD [ "npm", "run", "start" ]
