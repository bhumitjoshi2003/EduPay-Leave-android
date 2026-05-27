import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Permission, RolePermissionMatrix } from '../interfaces/permission';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private baseUrl = `${environment.apiUrl}/permissions`;

  constructor(private http: HttpClient) {}

  getAllPermissions(): Observable<Permission[]> {
    return this.http.get<Permission[]>(this.baseUrl);
  }

  getRolePermissionMatrix(): Observable<RolePermissionMatrix[]> {
    return this.http.get<RolePermissionMatrix[]>(`${this.baseUrl}/matrix`);
  }
}
