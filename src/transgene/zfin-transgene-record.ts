import { Transgene } from './transgene.entity';

export class ZfinTransgeneRecord {
  constructor(
    private genomicFeatureID?: string,
    private genomicFeatureAbbreviation?: string,
    private genomicFeatureName?: string,
    private featureSOID?: string,
    private constructID?: string,
    private constructName?: string,
    private constructSOID?: string,
  ) {}

  /**
   * Is this line a transgene construct — the thing this API answers for?
   *
   * Some transgenes are sort of a mutation, and those get TWO lines in the tgInsertions file: one
   * for the construct and one for the mutated gene. Only the construct line is ours.
   *
   * Incidentally rejects the empty string left by the file's trailing newline, which has no
   * ZDB-TGCONSTRCT id. That is also what lets TransgeneService treat "nothing parsed" as a failed
   * download rather than an empty dataset. (The file has no header row.)
   *
   * Returns a real boolean. It used to return `this.constructID && ...`, which is `undefined` for a
   * line with no construct id — truthy-correct at the one call site, but a declared-boolean method
   * that can hand back undefined is a trap for the next caller.
   */
  isConstruct(): boolean {
    return !!this.constructID && this.constructID.startsWith('ZDB-TGCONSTRCT');
  }
  convertToTransgene(): Transgene {
    return new Transgene(
      this.genomicFeatureID,
      this.genomicFeatureAbbreviation,
      this.constructID,
      this.constructName,
    );
  }
}
