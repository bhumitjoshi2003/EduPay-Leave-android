import { of } from 'rxjs';
import { NotificationNavigationService } from './notification-navigation.service';

describe('NotificationNavigationService', () => {
  it('maps historical teacher-leave notifications to the supported route', async () => {
    const router = jasmine.createSpyObj('Router', ['navigate']);
    router.navigate.and.resolveTo(true);
    const auth = jasmine.createSpyObj('AuthStateService', ['getUserRole']);
    auth.getUserRole.and.returnValue('TEACHER');
    const parentPortal = jasmine.createSpyObj('ParentPortalService', ['getMyProfile']);
    parentPortal.getMyProfile.and.returnValue(of({ children: [] }));
    const childContext = jasmine.createSpyObj('ParentChildContextService', ['select']);
    const toast = jasmine.createSpyObj('ToastService', ['warning']);
    const service = new NotificationNavigationService(router, auth, parentPortal, childContext, toast);

    expect(await service.navigate({ actionRoute: '/dashboard/my-leave' })).toBeTrue();
    expect(router.navigate).toHaveBeenCalledWith(
      ['/dashboard/apply-teacher-leave'],
      { queryParams: {} }
    );
  });
});
