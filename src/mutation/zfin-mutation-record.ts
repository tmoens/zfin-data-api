// This class is used to model a row in the data file from the following site:
// https://zfin.org/downloads/features-affected-genes.txt.
// To all intents and purposes this is the ZFIN Mutations list.
// This are the fields on each row of the ZFIN mutations download page.
//
// Genomic Feature ID -> the ZFIN ID for the (mutation)
// Feature SO ID -> the kind of mutation SO:10000008 is a point mutation, for example.
// Genomic Feature Abbreviation -> the allele name. Users know this.
// Gene Symbol -> the common name for the affected generateInput
// Gene ID -> the ZFIN Id for the gene
// Gene SO ID -> Usuallly SO:10001217.  That is, GENE.
// Genomic Feature - Marker Relationship -> Usuually "is allele of"
// Feature Type -> looks like some kind of ennumeration code like "POINT_MUTATION"
// DNA/cDNA Change SO ID -> An SO code for a basepair transition like: SO:1000021 is "T_to_A_transversion"
// Reference Nucleotide -> something like "T"
// Mutant Nucleotide -> something like "A", but this seems to be missing from the ZFIN file.
// Base Pairs Added
// Base Pairs Removed
// DNA/cDNA Change Position Start
// DNA/cDNA Change Position End
// DNA/cDNA Reference Sequence -> Rarely used and then it is a pointer to a ref seq in another system
// DNA/cDNA Change Localization
// DNA/cDNA Change Localization SO ID
// DNA/cDNA Change Localization Exon
// DNA/cDNA Change Localization Intron
// Transcript Consequence -> e.g. premature stop, frameshift, etc.
// Transcript Consequence SO ID -> Code for the Transcript consequence
// Transcript Consequence Exon
// Transcript Consequence Intron
// Protein Consequence -> e.g. amino acid deletion	or polypeptide truncation
// Protein Consequence SO ID	-> code for the Protien consequence
// Reference Amino Acid
// Mutant Amino Acid
// Amino Acids Added
// Amino Acids Removed
// Protein Consequence Position Start
// Protein Consequence Position End
// Protein Reference Sequence

import { Mutation } from "./entities/mutation.entity";

export class ZfinMutationRecord {
  constructor(
    private genomicFeatureId?: string,
    private featureSOID?: string,
    private genomicFeatureAbbreviation?: string,
    private geneSymbol?: string,
    private geneID?: string,
    private geneSOID?: string,
    private genomicFeatureMarkerRelationship?: string,
    private featureType?: string,
    private dNAcDNAChangeSOID?: string,
    private referenceNucleotide?: string,
    private mutantNucleotide?: string,
    private basePairsAdded?: string,
    private basePairsRemoved?: string,
    private dNAcDNAChangePositionStart?: string,
    private dNAcDNAChangePositionEnd?: string,
    private dNAcDNAReferenceSequence?: string,
    private dNAcDNAChangeLocalization?: string,
    private dNAcDNAChangeLocalizationSOID?: string,
    private dNAcDNAChangeLocalizationExon?: string,
    private dNAcDNAChangeLocalizationIntron?: string,
    private transcriptConsequence?: string,
    private transcriptConsequenceSOID?: string,
    private transcriptConsequenceExon?: string,
    private transcriptConsequenceIntron?: string,
    private proteinConsequence?: string,
    private proteinConsequenceSOID?: string,
    private referenceAminoAcid?: string,
    private mutantAminoAcid?: string,
    private aminoAcidsAdded?: string,
    private aminoAcidsRemoved?: string,
    private proteinConsequencePositionStart?: string,
    private proteinConsequencePositionEnd?: string,
    private proteinReferenceSequence?: string
  ) {
  }

  isDeficiencyOrTranslocation(): boolean {
    return this.featureType === "TRANSLOC" || this.featureType === "DEFICIENCY";
  }

  convertToMutation(): Mutation {
    return new Mutation(
      this.genomicFeatureId,
      this.genomicFeatureAbbreviation,
      this.geneSymbol,
      this.geneID,
      this.featureType,
      this.transcriptConsequence
    );
  }
}
