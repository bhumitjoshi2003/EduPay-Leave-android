import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface BusResponse {
  id: number;
  busNumber: string;
  displayName: string;
  capacity: number;
  make?: string;
  model?: string;
  registrationNumber?: string;
  active: boolean;
}

export interface DriverResponse {
  id: number;
  driverId: string;
  name: string;
  email: string;
  phone?: string;
  phoneNumber?: string;
  licenseNumber?: string;
  dob?: string;
  gender?: string;
  active?: boolean;
  isActive: boolean;
  deviceBound: boolean;
}

export interface StopResponse {
  id: number;
  name?: string;
  stopName: string;
  latitude: number;
  longitude: number;
  sequenceOrder?: number;
  sequence: number;
  geofenceRadius?: number;
  estimatedMinutesFromStart?: number;
}

export interface RouteResponse {
  id: number;
  name?: string;
  routeName: string;
  routeType: string;
  description?: string;
  stops?: StopResponse[];
}

export interface TripResponse {
  id: number;
  busId: number;
  busDisplayName: string;
  busNumber: string;
  driverId: number;
  driverName: string;
  routeId: number;
  routeName: string;
  tripType: string;
  tripDate: string;
  status: string;
  startTime?: string;
  endTime?: string;
}

export interface ActiveBusSummary {
  tripId: number;
  busId: number;
  busDisplayName: string;
  busNumber: string;
  driverId: number;
  driverName: string;
  routeId: number;
  routeName: string;
  status: string;
  tripType: string;
  latitude?: number;
  longitude?: number;
  speed?: number;
  boardedCount?: number;
  droppedCount?: number;
  absentCount?: number;
  expectedCount?: number;
  nextStopName?: string;
  nextStopEta?: string;
}

export interface FleetSummaryResponse {
  totalActiveBuses: number;
  totalStudentsOnRoad: number;
  boardedCount: number;
  wrongBusAlerts: number;
  activeBuses: ActiveBusSummary[];
}


export interface PassengerResponse {
  studentId: string;
  studentName: string;
  stopId: number;
  stopName: string;
  status: string;
  eventTime?: string;
  wrongBusFlag?: boolean;
}

export interface DailyBusStats {
  busId: number;
  busDisplayName: string;
  tripCount: number;
  boardedCount: number;
  droppedCount: number;
  absentCount: number;
  expectedCount: number;
}

export interface DailyTransportReport {
  reportDate: string;
  totalTrips: number;
  totalBoardings: number;
  totalDropOffs: number;
  totalAbsences: number;
  busStats: DailyBusStats[];
}

export interface WrongBusAlertResponse {
  id: number;
  tripId: number;
  studentId: string;
  studentName: string;
  busId: number;
  busDisplayName: string;
  assignedBusId?: number;
  assignedBusDisplayName?: string;
  eventTime: string;
}

export interface BusRequest {
  busNumber: string;
  displayName: string;
  capacity: number;
  make?: string;
  model?: string;
  registrationNumber?: string;
}

export interface DriverRequest {
  driverId: string;
  name: string;
  email: string;
  phoneNumber: string;
  dob?: string;
  gender?: string;
  licenseNumber?: string;
  password?: string;
}

export interface RouteRequest {
  routeName: string;
  routeType: 'MORNING' | 'AFTERNOON' | 'CUSTOM';
}

export interface StopRequest {
  stopName: string;
  sequence: number;
  latitude: number;
  longitude: number;
  geofenceRadius?: number;
}

export interface StudentBusAssignmentRequest {
  studentId: string;
  busId: number;
  routeId: number;
  stopId: number;
  academicYear: string;
}

export interface StudentBusAssignmentResponse {
  id: number;
  studentId: string;
  studentName: string;
  busId: number;
  busDisplayName: string;
  busNumber: string;
  routeId: number;
  routeName: string;
  stopId: number;
  stopName: string;
  academicYear: string;
  isActive: boolean;
}

export interface DriverAssignmentRequest {
  driverId: string;
  busId: number;
  morningRouteId?: number | null;
  afternoonRouteId?: number | null;
}

export interface DriverAssignmentResponse {
  id: number;
  schoolId: string;
  driverId: string;
  driverName: string;
  busId: number;
  busNumber: string;
  busDisplayName: string;
  morningRouteId?: number;
  morningRouteName?: string;
  afternoonRouteId?: number;
  afternoonRouteName?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DailyOverrideRequest {
  overrideDate: string;
  originalDriverId?: string;
  substituteDriverId?: string;
  busId: number;
  routeId: number;
  tripType: 'MORNING' | 'AFTERNOON' | 'CUSTOM';
  isCancelled: boolean;
  cancelReason?: string;
}

export interface DailyOverrideResponse {
  id: number;
  schoolId: string;
  overrideDate: string;
  originalDriverId?: string;
  originalDriverName?: string;
  substituteDriverId?: string;
  substituteDriverName?: string;
  busId: number;
  busDisplayName: string;
  routeId: number;
  routeName: string;
  tripType: string;
  isCancelled: boolean;
  cancelReason?: string;
  createdAt: string;
}

export interface LiveBusLocationResponse {
  busId: number;
  tripId: number;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  accuracy: number;
  lastUpdated: string;
  tripStatus: string;
  driverName: string;
  driverPhone: string;
  busDisplayName: string;
  busNumber: string;
  nextStopSequence: number;
  nextStopName: string;
  etaMinutes?: number;
  flaggedAsMock: boolean;
}

export interface TripDetailResponse {
  id: number;
  schoolId: number;
  busId: number;
  busNumber: string;
  busDisplayName: string;
  routeId: number;
  routeName: string;
  driverId: string;
  driverName: string;
  tripType: string;
  tripDate: string;
  status: string;
  startTime?: string;
  endTime?: string;
  createdAt: string;
  totalExpected: number;
  totalBoarded: number;
  totalDropped: number;
  totalAbsent: number;
  totalPreMarkedAbsent: number;
  wrongBusIncidents: number;
  currentOccupancy: number;
  stopSummaries: StopBoardingSummary[];
}

export interface StopBoardingSummary {
  stopId: number;
  stopName: string;
  sequence: number;
  expectedStudents: number;
  boardedCount: number;
  droppedCount: number;
  absentCount: number;
  preMarkedAbsentCount: number;
  students: PassengerStatusResponse[];
}

export interface PassengerStatusResponse {
  studentId: string;
  studentName: string;
  className: string;
  stopId: number;
  stopName: string;
  stopSequence: number;
  status: string;
  wrongBusFlag: boolean;
}

export interface StudentAbsenceFlagRequest {
  studentId: string;
  tripDate: string;
  tripType: 'MORNING' | 'AFTERNOON' | 'CUSTOM';
  reason?: string;
}

export interface StudentAbsenceFlagResponse {
  id: number;
  studentId: string;
  studentName: string;
  busId: number;
  tripDate: string;
  tripType: string;
  markedByUserId: string;
  reason?: string;
  markedAt: string;
}

export interface StudentTransportHistoryResponse {
  tripDate: string;
  tripType: string;
  busDisplayName: string;
  routeName: string;
  boardingStatus?: string;
  preMarkedAbsent: boolean;
  eventTime?: string;
  stopName: string;
}

export interface BusSubscriptionInfo {
  busId: number;
  topic: string;
  eventsTopic: string;
}

@Injectable({ providedIn: 'root' })
export class TransportService {
  private readonly base = environment.apiUrl;
  private readonly opts = { withCredentials: true };

  constructor(private http: HttpClient) {}

  getFleetSummary(): Observable<FleetSummaryResponse> {
    return this.http.get<FleetSummaryResponse>(`${this.base}/transport/admin/fleet-summary`, this.opts);
  }

  getActiveTrips(): Observable<TripResponse[]> {
    return this.http.get<TripResponse[]>(`${this.base}/transport/trips/active`, this.opts);
  }

  getTripHistory(from: string, to: string): Observable<TripResponse[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<TripResponse[]>(`${this.base}/transport/trips/history`, { ...this.opts, params });
  }

  cancelTrip(tripId: number, reason: string): Observable<void> {
    return this.http.post<void>(`${this.base}/transport/trips/${tripId}/cancel`, { reason }, this.opts);
  }

  getTripPassengers(tripId: number): Observable<PassengerResponse[]> {
    return this.http.get<PassengerResponse[]>(`${this.base}/transport/boarding/trips/${tripId}/passengers`, this.opts);
  }

  getBuses(): Observable<BusResponse[]> {
    return this.http.get<BusResponse[]>(`${this.base}/transport/buses`, this.opts);
  }

  createBus(data: BusRequest): Observable<BusResponse> {
    return this.http.post<BusResponse>(`${this.base}/transport/buses`, data, this.opts);
  }

  updateBus(id: number, data: Partial<BusRequest>): Observable<BusResponse> {
    return this.http.put<BusResponse>(`${this.base}/transport/buses/${id}`, data, this.opts);
  }

  deleteBus(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/transport/buses/${id}`, this.opts);
  }

  getDrivers(): Observable<DriverResponse[]> {
    return this.http.get<DriverResponse[]>(`${this.base}/transport/drivers`, this.opts);
  }

  getRoutes(): Observable<RouteResponse[]> {
    return this.http.get<RouteResponse[]>(`${this.base}/transport/routes`, this.opts);
  }

  getRouteStops(routeId: number): Observable<StopResponse[]> {
    return this.http.get<StopResponse[]>(`${this.base}/transport/routes/${routeId}/stops`, this.opts);
  }



  getDailyReport(date: string): Observable<DailyTransportReport> {
    const params = new HttpParams().set('date', date);
    return this.http.get<DailyTransportReport>(`${this.base}/transport/admin/reports/daily`, { ...this.opts, params });
  }

  getWrongBusAlerts(from: string, to: string): Observable<WrongBusAlertResponse[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<WrongBusAlertResponse[]>(`${this.base}/transport/admin/reports/wrong-bus`, { ...this.opts, params });
  }

  // ─── Drivers ─────────────────────────────────────────────────────────────
  createDriver(data: DriverRequest): Observable<DriverResponse> {
    return this.http.post<DriverResponse>(`${this.base}/transport/drivers`, data, this.opts);
  }

  updateDriver(driverId: string, data: DriverRequest): Observable<DriverResponse> {
    return this.http.put<DriverResponse>(`${this.base}/transport/drivers/${driverId}`, data, this.opts);
  }

  deactivateDriver(driverId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/transport/drivers/${driverId}`, this.opts);
  }

  unbindDevice(driverId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/transport/drivers/${driverId}/bind-device`, this.opts);
  }

  // ─── Routes ──────────────────────────────────────────────────────────────
  createRoute(data: RouteRequest): Observable<RouteResponse> {
    return this.http.post<RouteResponse>(`${this.base}/transport/routes`, data, this.opts);
  }

  updateRoute(id: number, data: RouteRequest): Observable<RouteResponse> {
    return this.http.put<RouteResponse>(`${this.base}/transport/routes/${id}`, data, this.opts);
  }

  deactivateRoute(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/transport/routes/${id}`, this.opts);
  }

  addStop(routeId: number, data: StopRequest): Observable<StopResponse> {
    return this.http.post<StopResponse>(`${this.base}/transport/routes/${routeId}/stops`, data, this.opts);
  }

  updateStop(stopId: number, data: StopRequest): Observable<StopResponse> {
    return this.http.put<StopResponse>(`${this.base}/transport/stops/${stopId}`, data, this.opts);
  }

  deleteStop(stopId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/transport/stops/${stopId}`, this.opts);
  }

  reorderStops(routeId: number, orderedStopIds: number[]): Observable<StopResponse[]> {
    return this.http.put<StopResponse[]>(`${this.base}/transport/routes/${routeId}/stops/reorder`, orderedStopIds, this.opts);
  }

  // ─── Student Assignments ──────────────────────────────────────────────────
  getStudentAssignmentsByYear(academicYear: string): Observable<StudentBusAssignmentResponse[]> {
    const params = new HttpParams().set('academicYear', academicYear);
    return this.http.get<StudentBusAssignmentResponse[]>(`${this.base}/transport/student-assignments`, { ...this.opts, params });
  }

  createStudentAssignment(data: StudentBusAssignmentRequest): Observable<StudentBusAssignmentResponse> {
    return this.http.post<StudentBusAssignmentResponse>(`${this.base}/transport/student-assignments`, data, this.opts);
  }

  removeAssignment(assignmentId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/transport/student-assignments/${assignmentId}`, this.opts);
  }

  // ─── Driver Assignments ───────────────────────────────────────────────────
  getDriverAssignments(): Observable<DriverAssignmentResponse[]> {
    return this.http.get<DriverAssignmentResponse[]>(`${this.base}/transport/driver-assignments/default`, this.opts);
  }

  setDriverAssignment(data: DriverAssignmentRequest): Observable<DriverAssignmentResponse> {
    return this.http.post<DriverAssignmentResponse>(`${this.base}/transport/driver-assignments/default`, data, this.opts);
  }

  // ─── Daily Overrides ──────────────────────────────────────────────────────
  getOverrides(date: string): Observable<DailyOverrideResponse[]> {
    const params = new HttpParams().set('date', date);
    return this.http.get<DailyOverrideResponse[]>(`${this.base}/transport/driver-assignments/overrides`, { ...this.opts, params });
  }

  createOverride(data: DailyOverrideRequest): Observable<DailyOverrideResponse> {
    return this.http.post<DailyOverrideResponse>(`${this.base}/transport/driver-assignments/overrides`, data, this.opts);
  }

  // ─── Live Tracking ────────────────────────────────────────────────────────
  getLiveBusLocation(busId: number): Observable<LiveBusLocationResponse> {
    return this.http.get<LiveBusLocationResponse>(`${this.base}/transport/live/bus/${busId}`, this.opts);
  }

  getLiveFleet(): Observable<LiveBusLocationResponse[]> {
    return this.http.get<LiveBusLocationResponse[]>(`${this.base}/transport/live/fleet`, this.opts);
  }

  getStudentSubscriptionInfo(studentId: string, academicYear: string): Observable<BusSubscriptionInfo> {
    const params = new HttpParams().set('academicYear', academicYear);
    return this.http.get<BusSubscriptionInfo>(`${this.base}/transport/live/subscription-info/${studentId}`, { ...this.opts, params });
  }

  // ─── Trip Detail ──────────────────────────────────────────────────────────
  getTripDetail(tripId: number): Observable<TripDetailResponse> {
    return this.http.get<TripDetailResponse>(`${this.base}/transport/admin/trips/${tripId}/detail`, this.opts);
  }

  getBusOccupancy(busId: number): Observable<{ busId: number; occupancy: number }> {
    return this.http.get<{ busId: number; occupancy: number }>(`${this.base}/transport/admin/buses/${busId}/occupancy`, this.opts);
  }

  // ─── Student Assignment (student-facing) ──────────────────────────────────
  getMyTransportAssignment(studentId: string, academicYear: string): Observable<StudentBusAssignmentResponse> {
    const params = new HttpParams().set('academicYear', academicYear);
    return this.http.get<StudentBusAssignmentResponse>(`${this.base}/transport/student-assignments/student/${studentId}`, { ...this.opts, params });
  }

  // ─── Transport Absence ────────────────────────────────────────────────────
  markTransportAbsence(data: StudentAbsenceFlagRequest): Observable<StudentAbsenceFlagResponse> {
    return this.http.post<StudentAbsenceFlagResponse>(`${this.base}/transport/absence`, data, this.opts);
  }

  cancelTransportAbsence(studentId: string, tripDate: string, tripType: string): Observable<void> {
    const params = new HttpParams().set('tripDate', tripDate).set('tripType', tripType);
    return this.http.delete<void>(`${this.base}/transport/absence/${studentId}`, { ...this.opts, params });
  }

  // ─── Student Transport History (admin) ────────────────────────────────────
  getStudentTransportHistory(studentId: string, from: string, to: string): Observable<StudentTransportHistoryResponse[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<StudentTransportHistoryResponse[]>(`${this.base}/transport/admin/students/${studentId}/transport-history`, { ...this.opts, params });
  }
}
