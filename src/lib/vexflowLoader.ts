let vexflowPromise: Promise<typeof import('vexflow')> | null = null;

export const loadVexFlow = () => {
  vexflowPromise ??= import('vexflow');
  return vexflowPromise;
};

export const preloadVexFlow = () => {
  void loadVexFlow();
};
