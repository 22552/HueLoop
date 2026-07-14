# HueLoop's browser-only FFmpeg core.  It intentionally contains just the
# containers/formats and filters that the editor exposes.
FROM emscripten/emsdk:3.1.40 AS base
ARG EXTRA_CFLAGS
ARG EXTRA_LDFLAGS
ENV INSTALL_DIR=/opt
ENV FFMPEG_VERSION=n5.1.4
ENV CFLAGS="-I$INSTALL_DIR/include $CFLAGS $EXTRA_CFLAGS"
ENV CXXFLAGS="$CFLAGS"
ENV LDFLAGS="-L$INSTALL_DIR/lib $LDFLAGS $CFLAGS $EXTRA_LDFLAGS"
ENV EM_PKG_CONFIG_PATH=$EM_PKG_CONFIG_PATH:$INSTALL_DIR/lib/pkgconfig:/emsdk/upstream/emscripten/system/lib/pkgconfig
ENV PKG_CONFIG_PATH=$PKG_CONFIG_PATH:$EM_PKG_CONFIG_PATH
RUN apt-get update && apt-get install -y pkg-config autoconf automake libtool ragel && rm -rf /var/lib/apt/lists/*

FROM base AS x264-builder
ENV X264_BRANCH=4-cores
ADD https://github.com/ffmpegwasm/x264.git#$X264_BRANCH /src
COPY build/x264.sh /src/build.sh
RUN bash -x /src/build.sh

FROM base AS libvpx-builder
ENV LIBVPX_BRANCH=v1.13.1
ADD https://github.com/ffmpegwasm/libvpx.git#$LIBVPX_BRANCH /src
COPY build/libvpx.sh /src/build.sh
RUN bash -x /src/build.sh

FROM base AS zlib-builder
ENV ZLIB_BRANCH=v1.2.11
ADD https://github.com/ffmpegwasm/zlib.git#$ZLIB_BRANCH /src
COPY build/zlib.sh /src/build.sh
RUN bash -x /src/build.sh

FROM base AS ffmpeg-builder
ADD https://github.com/FFmpeg/FFmpeg.git#$FFMPEG_VERSION /src
COPY --from=x264-builder $INSTALL_DIR $INSTALL_DIR
COPY --from=libvpx-builder $INSTALL_DIR $INSTALL_DIR
COPY --from=zlib-builder $INSTALL_DIR $INSTALL_DIR
COPY build/ffmpeg.sh /src/build.sh
RUN bash -x /src/build.sh \
  --enable-gpl --disable-pthreads --disable-w32threads --disable-os2threads \
  --disable-everything --enable-libx264 --enable-libvpx --enable-zlib \
  --enable-encoder=gif --enable-encoder=libx264 --enable-encoder=libvpx-vp9 \
  --enable-decoder=png --enable-decoder=mjpeg --enable-decoder=gif --enable-decoder=webp \
  --enable-decoder=h264 --enable-decoder=vp8 --enable-decoder=vp9 \
  --enable-demuxer=image2 --enable-demuxer=gif --enable-demuxer=mov --enable-demuxer=matroska \
  --enable-muxer=gif --enable-muxer=mp4 --enable-muxer=webm \
  --enable-parser=h264 --enable-parser=vp9 --enable-protocol=file \
  --enable-filter=hue --enable-filter=scale --enable-filter=fps --enable-filter=eq \
  --enable-filter=palettegen --enable-filter=paletteuse --enable-filter=format

FROM ffmpeg-builder AS wasm-builder
COPY src/bind /src/src/bind
COPY src/fftools /src/src/fftools
COPY build/ffmpeg-wasm.sh /src/build.sh
ENV FFMPEG_LIBS="-lx264 -lvpx -lz"
RUN mkdir -p /src/dist/esm && bash -x /src/build.sh $FFMPEG_LIBS -sEXPORT_ES6 -s INITIAL_MEMORY=33554432 -o /src/dist/esm/ffmpeg-core.js

FROM scratch AS export
COPY --from=wasm-builder /src/dist /dist
