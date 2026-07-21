import { useCallback } from 'react';
import { useWindowControls } from './useWindowControls';

export function useWorkspacePicker() {
  const { selectWorkspace } = useWindowControls();

  return useCallback(async () => {
    try {
      await selectWorkspace();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Không chọn được repository.');
    }
  }, [selectWorkspace]);
}
