// Entity id builders (plan §4.1). Ids are lowercased and use one format per kind:
//
//   most kinds        name|source
//   subclass          shortName|className|classSource|source
//   classFeature      name|className|classSource|level|source
//   subclassFeature   name|className|classSource|subclassShortName|subclassSource|level|source
//   rule              <ruleKind>/name|source   (rule kinds share one table, so the kind is part
//                                              of the id; item properties use their abbreviation)

import type { Id, SourceCode } from './common.ts';
import type { RuleKind } from './content.ts';

function join(parts: (string | number)[]): Id {
  return parts
    .map((p) => String(p).trim())
    .join('|')
    .toLowerCase();
}

export function nameSourceId(name: string, source: SourceCode): Id {
  return join([name, source]);
}

export function classId(className: string, classSource: SourceCode): Id {
  return join([className, classSource]);
}

export function subclassId(
  shortName: string,
  className: string,
  classSource: SourceCode,
  source: SourceCode,
): Id {
  return join([shortName, className, classSource, source]);
}

export function classFeatureId(
  name: string,
  className: string,
  classSource: SourceCode,
  level: number,
  source: SourceCode,
): Id {
  return join([name, className, classSource, level, source]);
}

export function subclassFeatureId(
  name: string,
  className: string,
  classSource: SourceCode,
  subclassShortName: string,
  subclassSource: SourceCode,
  level: number,
  source: SourceCode,
): Id {
  return join([name, className, classSource, subclassShortName, subclassSource, level, source]);
}

export function ruleId(ruleKind: RuleKind, name: string, source: SourceCode): Id {
  return `${ruleKind}/${join([name, source])}`;
}
