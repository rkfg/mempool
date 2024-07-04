import { Router, NavigationStart } from '@angular/router';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { StateService } from './state.service';
import { StorageService } from './storage.service';
import { MenuGroup } from '../interfaces/services.interface';
import { Observable, of, ReplaySubject, tap, catchError, share, filter, switchMap } from 'rxjs';
import { IBackendInfo } from '../interfaces/websocket.interface';
import { Acceleration, AccelerationHistoryParams } from '../interfaces/node-api.interface';
import { AccelerationStats } from '../components/acceleration/acceleration-stats/acceleration-stats.component';

export type ProductType = 'enterprise' | 'community' | 'mining_pool' | 'custom';
export interface IUser {
  username: string;
  email: string | null;
  passwordIsSet: boolean;
  snsId: string;
  type: ProductType;
  subscription_tag: string;
  status: 'pending' | 'verified' | 'disabled';
  features: string | null;
  fullName: string | null;
  countryCode: string | null;
  imageMd5: string;
  ogRank: number | null;
}

// Todo - move to config.json
const SERVICES_API_PREFIX = `/api/v1/services`;

@Injectable({
  providedIn: 'root'
})
export class ServicesApiServices {
  apiBaseUrl: string; // base URL is protocol, hostname, and port
  apiBasePath: string; // network path is /testnet, etc. or '' for mainnet

  userSubject$ = new ReplaySubject<IUser | null>(1);
  currentAuth = null;

  constructor(
    private httpClient: HttpClient,
    private stateService: StateService,
    private storageService: StorageService,
    private router: Router,
  ) {
    this.currentAuth = localStorage.getItem('auth');

    this.apiBaseUrl = ''; // use relative URL by default
    if (!stateService.isBrowser) { // except when inside AU SSR process
      this.apiBaseUrl = this.stateService.env.NGINX_PROTOCOL + '://' + this.stateService.env.NGINX_HOSTNAME + ':' + this.stateService.env.NGINX_PORT;
    }
    this.apiBasePath = ''; // assume mainnet by default
    this.stateService.networkChanged$.subscribe((network) => {
      this.apiBasePath = network ? '/' + network : '';
    });

    if (this.stateService.env.GIT_COMMIT_HASH_MEMPOOL_SPACE) {
      this.getServicesBackendInfo$().subscribe(version => {
        this.stateService.servicesBackendInfo$.next(version);
      })
    }

    this.getUserInfo$().subscribe();
    this.router.events.pipe(
      filter((event) => event instanceof NavigationStart && this.currentAuth !== localStorage.getItem('auth')),
      switchMap(() => this.getUserInfo$()),
    ).subscribe();
  }

  /**
   * Do not call directly, userSubject$ instead
   */
  private getUserInfo$() {
    return this.getUserInfoApi$().pipe(
      tap((user) => {
        this.userSubject$.next(user);
      }),
      catchError((e) => {
        if (e.error === 'User does not exists') {
          this.userSubject$.next(null);
          this.logout$().subscribe();
          return of(null);
        }
        this.userSubject$.next(null);
        return of(null);
      }),
      share(),
    )
  }

  /**
   * Do not call directly, userSubject$ instead
   */
  private getUserInfoApi$(): Observable<any> {
    const auth = this.storageService.getAuth();
    if (!auth) {
      return of(null);
    }

    return this.httpClient.get<any>(`${SERVICES_API_PREFIX}/account`);
  }

  getUserMenuGroups$(): Observable<MenuGroup[]> {
    const auth = this.storageService.getAuth();
    if (!auth) {
      return of(null);
    }

    return this.httpClient.get<MenuGroup[]>(`${SERVICES_API_PREFIX}/account/menu`);
  }

  logout$(): Observable<any> {
    const auth = this.storageService.getAuth();
    if (!auth) {
      return of(null);
    }

    localStorage.removeItem('auth');
    return this.httpClient.post(`${SERVICES_API_PREFIX}/auth/logout`, {});
  }

  getJWT$() {
    return this.httpClient.get<any>(`${SERVICES_API_PREFIX}/auth/getJWT`);
  }

  getServicesBackendInfo$(): Observable<IBackendInfo> {
    return this.httpClient.get<IBackendInfo>(`${SERVICES_API_PREFIX}/version`);
  }

  estimate$(txInput: string) {
    return this.httpClient.post<any>(`${SERVICES_API_PREFIX}/accelerator/estimate`, { txInput: txInput }, { observe: 'response' });
  }

  accelerate$(txInput: string, userBid: number, accelerationUUID: string) {
    return this.httpClient.post<any>(`${SERVICES_API_PREFIX}/accelerator/accelerate`, { txInput: txInput, userBid: userBid, accelerationUUID: accelerationUUID });
  }

  accelerateWithCashApp$(txInput: string, token: string, cashtag: string, referenceId: string, accelerationUUID: string) {
    return this.httpClient.post<any>(`${SERVICES_API_PREFIX}/accelerator/accelerate/cashapp`, { txInput: txInput, token: token, cashtag: cashtag, referenceId: referenceId, accelerationUUID: accelerationUUID });
  }

  getAccelerations$(): Observable<Acceleration[]> {
    return this.httpClient.get<Acceleration[]>(`${SERVICES_API_PREFIX}/accelerator/accelerations`);
  }

  getAggregatedAccelerationHistory$(params: AccelerationHistoryParams): Observable<any> {
    return this.httpClient.get<any>(`${SERVICES_API_PREFIX}/accelerator/accelerations/history/aggregated`, { params: { ...params }, observe: 'response' });
  }

  getAccelerationHistory$(params: AccelerationHistoryParams): Observable<Acceleration[]> {
    return this.httpClient.get<Acceleration[]>(`${SERVICES_API_PREFIX}/accelerator/accelerations/history`, { params: { ...params } });
  }

  getAccelerationHistoryObserveResponse$(params: AccelerationHistoryParams): Observable<any> {
    return this.httpClient.get<any>(`${SERVICES_API_PREFIX}/accelerator/accelerations/history`, { params: { ...params }, observe: 'response'});
  }

  getAccelerationStats$(params: AccelerationHistoryParams): Observable<AccelerationStats> {
    return this.httpClient.get<AccelerationStats>(`${SERVICES_API_PREFIX}/accelerator/accelerations/stats`, { params: { ...params } });
  }

  setupSquare$(): Observable<{squareAppId: string, squareLocationId: string}> {
    return this.httpClient.get<{squareAppId: string, squareLocationId: string}>(`${SERVICES_API_PREFIX}/square/setup`);
  }

  getFaucetStatus$() {
    return this.httpClient.get<{ address?: string, min: number, max: number, code: 'ok' | 'faucet_not_available' | 'faucet_maximum_reached' | 'faucet_too_soon'}>(`${SERVICES_API_PREFIX}/testnet4/faucet/status`, { responseType: 'json' });
  }

  requestTestnet4Coins$(address: string, sats: number) {
    return this.httpClient.get<{txid: string}>(`${SERVICES_API_PREFIX}/testnet4/faucet/request?address=${address}&sats=${sats}`, { responseType: 'json' });
  }

  generateBTCPayAcceleratorInvoice$(txid: string, sats: number): Observable<any> {
    const params = {
      product: txid,
      amount: sats,
    };
    return this.httpClient.post<any>(`${SERVICES_API_PREFIX}/payments/bitcoin`, params);
  }

  retreiveInvoice$(invoiceId: string): Observable<any[]> {
    return this.httpClient.get<any[]>(`${SERVICES_API_PREFIX}/payments/bitcoin/invoice?id=${invoiceId}`);
  }

  getPaymentStatus$(orderId: string): Observable<any[]> {
    return this.httpClient.get<any[]>(`${SERVICES_API_PREFIX}/payments/bitcoin/check?order_id=${orderId}`);
  }
}
