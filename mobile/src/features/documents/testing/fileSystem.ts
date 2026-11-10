// Stand-in for expo-file-system's File, which needs the native module. Keeps the URI it was built from.
export class MockFile {
  constructor(readonly uri: string) {}
}
