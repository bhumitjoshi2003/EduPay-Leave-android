import { TeacherOnboardingService } from './teacher-onboarding.service';

describe('TeacherOnboardingService', () => {
  let push: any;
  let service: TeacherOnboardingService;

  beforeEach(() => {
    push = jasmine.createSpyObj('PushNotificationService', ['permissionState', 'requestPermissionAndRegister']);
    push.permissionState.and.resolveTo('granted');
    push.requestPermissionAndRegister.and.resolveTo(true);
    service = new TeacherOnboardingService(push);
  });

  it('persists one structured per-teacher state object with Preferences', async () => {
    spyOn<any>(service, 'read').and.resolveTo(null);
    const write = spyOn<any>(service, 'write').and.resolveTo();
    const state = await service.load('T1');
    const updated = await service.markVisited('T1', state, 'attendanceVisited');
    expect(updated.attendanceVisited).toBeTrue();
    expect(write).toHaveBeenCalledWith('edunexify.teacher-onboarding.v1.T1', JSON.stringify(updated));
  });

  it('fails open when Preferences is unavailable', async () => {
    spyOn<any>(service, 'read').and.rejectWith(new Error('plugin unavailable'));
    const state = await service.load('T1');
    expect(state.profileVisited).toBeFalse();
    expect(state.minimized).toBeFalse();
  });
});
