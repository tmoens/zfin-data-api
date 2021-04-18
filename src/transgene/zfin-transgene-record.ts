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

  isConstruct() {
    return this.constructID && this.constructID.startsWith('ZDB-TGCONSTRCT');
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
