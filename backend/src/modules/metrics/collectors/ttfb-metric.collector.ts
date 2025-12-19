import { Injectable } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { URL } from 'node:url';
import {
  MetricCollector,
  MetricResult,
} from './metric-collector.interface';

export interface TtfbTimingBreakdown {
  /** Время DNS lookup (мс) */
  dnsLookupMs: number;
  /** Время TCP соединения (мс) */
  tcpConnectMs: number;
  /** Время TLS handshake (мс, только для HTTPS) */
  tlsHandshakeMs: number | null;
  /** Время ожидания первого байта от сервера после установки соединения (мс) */
  serverProcessingMs: number;
}

export interface TtfbMetricPayload {
  /** Общий TTFB от начала запроса до первого байта ответа */
  ttfbMs: number;
  /** Детальная разбивка по фазам */
  timing: TtfbTimingBreakdown;
  status: number | null;
  redirectCount: number;
  finalUrl: string;
  error?: string;
}

const MAX_REDIRECTS = 5;

@Injectable()
export class TtfbMetricCollector
  implements MetricCollector<TtfbMetricPayload> {
  readonly key = 'page.ttfb';
  readonly label = 'Time To First Byte';
  readonly description =
    'Измеряет время от отправки HTTP-запроса до получения первого байта ответа с детализацией по фазам (DNS, TCP, TLS, Server).';

  async collect(url: string): Promise<MetricResult<TtfbMetricPayload>> {
    const payload = await this.measure(url, 0);

    return {
      key: this.key,
      label: this.label,
      description: this.description,
      payload,
      collectedAt: new Date(),
    };
  }

  private async measure(
    url: string,
    redirectCount: number,
  ): Promise<TtfbMetricPayload> {
    const target = new URL(url);
    const isHttps = target.protocol === 'https:';
    const requester = isHttps ? httpsRequest : httpRequest;

    return new Promise<TtfbMetricPayload>((resolve) => {
      let settled = false;
      const settle = (payload: TtfbMetricPayload) => {
        if (!settled) {
          settled = true;
          resolve(payload);
        }
      };

      // Временные метки для каждой фазы
      let requestStartTime = 0;
      let dnsLookupTime = 0;
      let tcpConnectTime = 0;
      let tlsHandshakeTime = 0;
      let firstByteTime = 0;

      const req = requester(
        {
          hostname: target.hostname,
          path: target.pathname + target.search,
          protocol: target.protocol,
          port: target.port,
          method: 'GET',
          timeout: 10000,
          headers: {
            'User-Agent': 'NIR3-Metrics/1.0 (+https://example.com)',
          },
        },
        (res) => {
          // Время получения первого байта ответа (заголовки)
          firstByteTime = performance.now();

          const status = res.statusCode ?? null;

          // Рассчитываем метрики
          const ttfbMs = Math.round(firstByteTime - requestStartTime);

          const timing: TtfbTimingBreakdown = {
            dnsLookupMs: Math.round(dnsLookupTime - requestStartTime),
            tcpConnectMs: Math.round(tcpConnectTime - dnsLookupTime),
            tlsHandshakeMs: isHttps
              ? Math.round(tlsHandshakeTime - tcpConnectTime)
              : null,
            serverProcessingMs: Math.round(
              firstByteTime - (isHttps ? tlsHandshakeTime : tcpConnectTime),
            ),
          };

          // Обработка редиректов
          if (
            status &&
            status >= 300 &&
            status < 400 &&
            res.headers.location &&
            redirectCount < MAX_REDIRECTS
          ) {
            const nextUrl = new URL(res.headers.location, target).toString();
            res.resume();
            this.measure(nextUrl, redirectCount + 1).then(settle);
            return;
          }

          res.resume();
          settle({
            ttfbMs,
            timing,
            status,
            redirectCount,
            finalUrl: target.toString(),
          });
        },
      );

      // Отслеживаем события сокета для детального тайминга
      req.on('socket', (socket) => {
        // DNS lookup завершён
        socket.on('lookup', () => {
          dnsLookupTime = performance.now();
        });

        // TCP соединение установлено
        socket.on('connect', () => {
          tcpConnectTime = performance.now();
        });

        // TLS handshake завершён (только для HTTPS)
        socket.on('secureConnect', () => {
          tlsHandshakeTime = performance.now();
        });

        // Если сокет уже подключён (keep-alive переиспользование)
        if (socket.connecting === false) {
          // Сокет уже готов, пропускаем DNS и TCP фазы
          const now = performance.now();
          if (!dnsLookupTime) dnsLookupTime = now;
          if (!tcpConnectTime) tcpConnectTime = now;
          if (isHttps && !tlsHandshakeTime) tlsHandshakeTime = now;
        }
      });

      req.on('timeout', () => {
        req.destroy(new Error('Request timed out'));
      });

      req.on('error', (error) => {
        const now = performance.now();
        const ttfbMs = Math.round(now - requestStartTime);

        // Заполняем пустые значения текущим временем для расчёта
        if (!dnsLookupTime) dnsLookupTime = requestStartTime;
        if (!tcpConnectTime) tcpConnectTime = dnsLookupTime;
        if (!tlsHandshakeTime) tlsHandshakeTime = tcpConnectTime;

        settle({
          ttfbMs,
          timing: {
            dnsLookupMs: Math.round(dnsLookupTime - requestStartTime),
            tcpConnectMs: Math.round(tcpConnectTime - dnsLookupTime),
            tlsHandshakeMs: isHttps
              ? Math.round(tlsHandshakeTime - tcpConnectTime)
              : null,
            serverProcessingMs: 0,
          },
          status: null,
          redirectCount,
          finalUrl: target.toString(),
          error: (error as Error).message,
        });
      });

      // Засекаем время и отправляем запрос
      requestStartTime = performance.now();
      req.end();
    });
  }
}
