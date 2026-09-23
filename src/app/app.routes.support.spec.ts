import { Route } from '@angular/router';
import { routes } from './app.routes';

describe('app.routes — support ticket role access', () => {
  const dashboardChild = (path: string): Route => {
    const dashboard = routes.find(r => r.path === 'dashboard')!;
    return dashboard.children!.find(r => r.path === path)!;
  };
  const normalRoles = ['STUDENT', 'TEACHER', 'ADMIN', 'SUB_ADMIN', 'PARENT'];

  for (const path of ['report-problem', 'my-support-requests']) {
    it(`${path} is open to every normal role but not SUPER_ADMIN`, () => {
      const roles: string[] = dashboardChild(path).data!['roles'];
      expect([...roles].sort()).toEqual([...normalRoles].sort());
      expect(roles).not.toContain('SUPER_ADMIN');
    });
  }

  it('support-queue is SUPER_ADMIN only', () => {
    expect(dashboardChild('support-queue').data!['roles']).toEqual(['SUPER_ADMIN']);
  });
});
