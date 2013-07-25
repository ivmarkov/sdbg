// Copyright (c) 2013, the Dart project authors.  Please see the AUTHORS file
// for details. All rights reserved. Use of this source code is governed by a
// BSD-style license that can be found in the LICENSE file.

part of dart.convert;

/**
 * The [ByteConversionSink] provides an interface for converters to
 * efficiently transmit byte data.
 *
 * Instead of limiting the interface to one non-chunked list of bytes it
 * accepts its input in chunks (themselves being lists of bytes).
 */
abstract class ByteConversionSink extends ChunkedConversionSink<List<int>> {
  ByteConversionSink();
  factory ByteConversionSink.withCallback(void callback(List<int> accumulated))
      = _ByteCallbackSink;
  factory ByteConversionSink.from(ChunkedConversionSink<List<int>> sink)
      = _ByteAdapterSink;

  /**
   * Adds the next [chunk] to `this`.
   *
   * Adds the bytes defined by [start] and [end]-exclusive to `this`.
   *
   * If [isLast] is `true` closes `this`.
   *
   * The given [chunk] is not held onto. Once the method returns, it is safe to
   * overwrite the data in it.
   */
  void addSlice(List<int> chunk, int start, int end, bool isLast);

  // TODO(floitsch): add more methods:
  // - iterateBytes.
}

/**
 * This class provides a base-class for converters that need to accept byte
 * inputs.
 */
abstract class ByteConversionSinkBase extends ByteConversionSink {

  void add(List<int> chunk);
  void close();

  void addSlice(List<int> chunk, int start, int end, bool isLast) {
    if (start != 0 || end != chunk.length) {
      add(chunk.sublist(start, end));
    } else {
      add(chunk);
    }
    if (isLast) close();
  }
}

/**
 * This class adapts a simple [ChunkedConversionSink] to a [ByteConversionSink].
 *
 * All additional methods of the [ByteConversionSink] (compared to the
 * ChunkedConversionSink) are redirected to the `add` method.
 */
class _ByteAdapterSink extends ByteConversionSinkBase {
  final ChunkedConversionSink<List<int>> _sink;

  _ByteAdapterSink(this._sink);

  void add(List<int> chunk) => _sink.add(chunk);
  void close() => _sink.close();
}

/**
 * This class accumulates all chunks into one list of bytes
 * and invokes a callback when the sink is closed.
 *
 * This class can be used to terminate a chunked conversion.
 */
class _ByteCallbackSink extends ByteConversionSinkBase {
  static const _INITIAL_BUFFER_SIZE = 1024;

  final _ChunkedConversionCallback<List<int>> _callback;
  // TODO(11971, floitsch): use Uint8List instead of normal lists.
  List<int> _buffer = new List<int>(_INITIAL_BUFFER_SIZE);
  int _bufferIndex = 0;

  _ByteCallbackSink(void callback(List<int> accumulated))
      : this._callback = callback;

  void add(Iterable<int> chunk) {
    int freeCount = _buffer.length - _bufferIndex;
    if (chunk.length > freeCount) {
      // Grow the buffer.
      int oldLength = _buffer.length;
      int newLength = _roundToPowerOf2(chunk.length + oldLength) * 2;
      // TODO(11971, floitsch): use Uint8List instead of normal lists.
      List<int> grown = new List<int>(newLength);
      grown.setRange(0, _buffer.length, _buffer);
      _buffer = grown;
    }
    _buffer.setRange(_bufferIndex, _bufferIndex + chunk.length, chunk);
    _bufferIndex += chunk.length;
  }

  static int _roundToPowerOf2(int v) {
    assert(v > 0);
    v--;
    v |= v >> 1;
    v |= v >> 2;
    v |= v >> 4;
    v |= v >> 8;
    v |= v >> 16;
    v++;
    return v;
  }

  void close() {
    _callback(_buffer.sublist(0, _bufferIndex));
  }
}
