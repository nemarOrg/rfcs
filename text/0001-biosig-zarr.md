---
number: 1
title: "biosig-zarr: a Zarr format for biosignal recordings, with .bzx as its single-file form"
scope: org
dataset: null
shepherd: Seyed Yahya Shirazi
authors: [Seyed Yahya Shirazi]
discussion: null
opened_at: null
window_days: 21
extension: null
final_comment_at: null
proposed_disposition: null
decision: null
decided_at: null
decided_by: null
adr: null
supersedes_rfc: null
withdrawn_at: null
withdrawn_reason: null
---

# NEMAR RFC 0001: biosig-zarr, with `.bzx` as its single-file form

The specification text this Request for Comments (RFC) proposes is the comparison
[`2.0.0...3.0.0-draft.1`](https://github.com/nemarOrg/biosig-zarr/compare/2.0.0...3.0.0-draft.1) in nemarOrg/biosig-zarr.

## Summary

As of 2026-11-20, the Neuroelectromagnetic Data Archive and Tools Resource (NEMAR) serves 231,259 biosig-zarr stores,
one for each of 98.4% of the 235,038 raw recordings in its 910 public datasets,
covering about 116,285 hours of recordings (the sum of the public catalog's `total_recording_duration`; see "History of the format").
Our data viewer reads these stores to show any recording in a browser without a download,
and our Model Context Protocol (MCP) server reads them so that research agents can query and analyze signals directly.

In this RFC, "store" always means a biosig-zarr store:
the Zarr version 3 store for one recording, laid out as the specification describes.
Any other Zarr store is called a Zarr store.

NEMAR serves every raw recording it holds a second time, as a store shaped for fast partial reads over a network.
Until this month the layout was whatever one library wrote.
We have now written it down as its own specification, `biosig-zarr`, in its own repository, [nemarOrg/biosig-zarr](https://github.com/nemarOrg/biosig-zarr),
so that archives, viewers and analysis tools other than ours can read and write the same stores.
A store can also be packed into one file with the suffix `.bzx`, which can then stand in for a data file on a researcher's disk.

We ask for comments on the whole format before it is frozen,
from anyone who records, shares, analyzes or builds tools for biosignals of any kind:
electroencephalography (EEG), magnetoencephalography (MEG), intracranial EEG (iEEG), electromyography (EMG), electrocardiography (ECG),
other physiological recordings, motion and wearable sensors,
and from the people who build Zarr tools.
The RFC also proposes `format_version` 3, to fix two things version 2 cannot express.
First, a version 2 store has one uniform time axis, so it cannot say that a recording paused, that a stream was sampled irregularly, or that a signal is sparse.
Second, a version 2 store records how samples are stored, but not the resolution of the source recording they came from.

This RFC proposes normative changes to the text tagged `2.0.0`, which is version 2 as NEMAR serves it today.
The proposed text is tagged `3.0.0-draft.1` when the RFC opens, and becomes `3.0.0` only if the RFC is accepted.

## Scope

This is an organization RFC.
It covers the whole biosig-zarr format: the store (the directory form) and its single-file form, `.bzx`.
It does not cover any one dataset, and it changes no dataset's content.

### Who should read this

If you record, share or analyze biosignals of any kind, read "Problem", the two parts of "Proposal" on time and resolution, and "Questions for commenters".
Tell us whether the time model fits your recordings, and whether a store says enough about what was done to your samples.

If you build Zarr readers, writers or viewers, read "The format today", "The single-file form, `.bzx`" and "Prior art".
Tell us whether your tool can read the layout, and whether you can implement the packing rules.

If you maintain a neighboring standard, such as the Brain Imaging Data Structure (BIDS), Neurodata Without Borders (NWB) or OME-Zarr from the Open Microscopy Environment (OME),
"Options considered" and "Prior art" describe how this format relates to yours, and where it deliberately departs from it.

### What is open for comment

Everything in the version 2 text is open for comment, including its 33 open questions,
and so is everything this RFC proposes for version 3.
The items under "Decided, and out of scope for comment" are closed, each with the record that closed it.

When the RFC opens, nemarOrg/biosig-zarr will hold the proposed text, its JavaScript Object Notation (JSON) schemas, and a few conformance test vectors made from real recordings.
The conformance suite starts with those vectors, and each of the four reader-safety layers of the proposal has at least one case in it that fails when the check is removed.
No tool writes or reads `.bzx` yet, and no version 3 writer exists.
We are publishing before the first implementation on purpose, while the rules are still cheap to change.

## Problem

### A store needs a contract that outlives one implementation

One library, [biosigIO](https://github.com/neuromechanist/biosigio), writes our stores, and until 2026-11-18 the layout was whatever that library wrote.
A format defined by its only implementation cannot be implemented a second time with confidence, and it changes whenever the library does.
The specification reverses that relation: the specification defines the format, and biosigIO is one exemplar implementation.
Its text was first published on docs.nemar.org on 2026-11-18, moved to nemarOrg/biosig-zarr without normative change on 2026-11-20, and tagged [`2.0.0`](https://github.com/nemarOrg/biosig-zarr/blob/2.0.0/spec/index.md).
This RFC is its first public review.

### Version 2 cannot represent time that is not one uniform, continuous axis

The "Time axis" paragraph of the `2.0.0` text, in the section "Level-0 array" ([lines 363 to 365](https://github.com/nemarOrg/biosig-zarr/blob/2.0.0/spec/index.md#L363-L365)), reads:

> Level 0 is uniformly sampled.
> Sample `i` of a group lies `i / rate` seconds after the start of the recording.

Its open question 9 ([lines 737 and 738](https://github.com/nemarOrg/biosig-zarr/blob/2.0.0/spec/index.md#L737-L738)) states the consequence:

> A recording that is not continuous has no representation.
> There is one uniform time axis per group, and no per-sample timestamps.

Three kinds of data run into this limit.

The first is a recording with gaps, where the recorder paused and resumed.
Classic European Data Format (EDF) assumes contiguous data records.
Its successor EDF Plus (EDF+) has a discontinuous variant (EDF+D) in which data records need not be contiguous and each record's start time is given by its time-keeping annotation.
The BioSemi Data Format (BDF) has the same variant, BrainVision files mark each restart with a "New Segment" marker,
and the Functional Image File Format (FIF) used for MEG and the Multiscale Electrophysiology Format version 3 (MEF3) record skips between data blocks.

The second is a jittered stream, which has a nominal rate but carries a measured timestamp for each sample.
The Extensible Data Format (XDF) written by the Lab Streaming Layer (LSL) works this way, and so do motion capture systems.

The third is a sparse or irregular signal,
such as a cuff blood pressure every few minutes, a temperature probe, or a value that arrives when it arrives.
EDF+D can encode irregular samples as individually timestamped records of duration 0, one sample per ordinary signal per record
([EDF+ specification](https://www.edfplus.info/specs/edfplus.html), sections 2.1.1, 2.1.2 and 2.2.4);
each such timestamp is per record and shared by every ordinary signal in it.
Version 2 has no representation for any of the three.

So the source formats can carry this timing; the trouble is that it is easy to lose on the way into another format, and version 2 has nowhere to put it.
The motivation for timestamped Zarr groups, and for gaps recorded on the grid, is to preserve that timing explicitly and to stream it in windows like any other signal.

Tools in use today already get the gap case wrong, so this is a present-day failure, not a hypothetical one.
On 2026-11-20 we wrote a small synthetic EDF+D file whose four one-second data records start at 0, 1, 10 and 11 seconds.
MNE-Python 1.12.1 and 1.13.2 both read it as 4 seconds of continuous signal.
Both place the sample recorded at 10.0 seconds at 2.0 seconds, an error of 8 seconds, and drop the annotation after the gap.
biosigIO 1.2.13 falls back to that reader for discontinuous files, so the store it writes carries the same shifted samples and no sign that anything was removed.
In a second file with a 1-second gap, the event that survives marks a sample recorded one second later than the event.
A BrainVision file with a second "New Segment" marker five seconds after the first segment ended shows the same shift, of 5 seconds.
The reports are [neuromechanist/biosigio#180](https://github.com/neuromechanist/biosigio/issues/180) (opened 2026-11-20)
and [mne-tools/mne-python#13429](https://github.com/mne-tools/mne-python/issues/13429) (opened 2025-09-25); both were open on 2026-11-20.
The reproduction used synthetic files.
We have not yet counted how many recordings NEMAR holds are affected; a scan of file headers that reads no samples will answer that before any re-conversion starts.

A version 2 store cannot show the problem even when the writer knows about it, because it has no field that claims continuity.
BIDS contributors have raised the same limit (all links checked 2026-11-20):

- BIDS Extension Proposal (BEP) 045, "Peripheral" physiology ([proposal page](https://bids.neuroimaging.io/extensions/beps/bep_045.html), [bids-specification#2267](https://github.com/bids-standard/bids-specification/pull/2267), a draft pull request opened 2025-11-22 and still open):
  the BIDS extension for raw physiological recordings, as part of whose writing the next issue was raised.
- [bids-specification#2313](https://github.com/bids-standard/bids-specification/issues/2313), "Storing sparse/non-continuous peripheral physiological data" (2026-01-19), written for BEP 045:
  sparse data such as pulse timestamps with no continuous series behind them, and continuous data whose sampling rate is not constant.
- [bids-specification#1771](https://github.com/bids-standard/bids-specification/issues/1771), the issue that BEP 047 (audio and video) grew from:
  in a [comment of 2024-04-22](https://github.com/bids-standard/bids-specification/issues/1771#issuecomment-2069822739) on the issue opened 2024-04-11, a commenter asked whether a recording that stopped and resumed is one file or several, quoting the discontinuous mode of EDF+.
  The [answer given that day](https://github.com/bids-standard/bids-specification/issues/1771#issuecomment-2070906065) was separate runs, with each run's start time in the scans file.
- [bids-specification#1796](https://github.com/bids-standard/bids-specification/issues/1796), "allow timestamps for physio table" (2024-04-18):
  an optional timestamp column for irregularly sampled physiological and motion tables, where `SamplingFrequency` assumes regular sampling.
- [bids-specification#2463](https://github.com/bids-standard/bids-specification/issues/2463), "Plain-text TSV for motion/physio doesn't scale" (2026-07-08):
  Zarr is a candidate there, with the remark that Zarr needs a fixed contract the way EDF has one.

### Version 2 records storage, not the source's resolution

The "Root attributes" table defines `dtype` ([line 195](https://github.com/nemarOrg/biosig-zarr/blob/2.0.0/spec/index.md#L195)) as
"`"int16"` or `"float32"`: the data type of every level-0 and view array in the store."
The level-0 attributes `scale`, `offset` and `physical_formula` ([lines 356 to 360](https://github.com/nemarOrg/biosig-zarr/blob/2.0.0/spec/index.md#L356-L360)) give each channel its own `scale` and `offset`,
and the "Dequantization" section ([lines 367 to 403](https://github.com/nemarOrg/biosig-zarr/blob/2.0.0/spec/index.md#L367-L403)) defines `physical = digital * scale + offset`.

Together they say how a stored sample becomes a physical value, but not what the source was.
A 24-bit amplifier recorded into a BDF file and requantized into a 16-bit store looks the same as a recording that was 16-bit to begin with.
A reader cannot tell how much resolution was given up, and an exporter cannot restore the source's own digital and physical ranges.

The same section says that in a 16-bit store a non-finite sample is replaced by the code nearest physical zero, and that "A store does not record which samples were replaced."
So a not-a-number (NaN) value in the source becomes a plausible zero that no reader can tell from data.

### What a fix has to guarantee

Four requirements shaped the proposal.

First, every biosignal gets a home.
Nothing is postponed to a later version to protect today's readers; the format is not final.

Second, a reader never silently misreads.
A reader that does not understand a feature refuses, with an error that names the feature.

Third, measured and derived values can be told apart.
A store says which samples and times are the source's own and which were computed.

Fourth, the common case stays cheap.
A continuous, uniformly sampled recording costs nothing extra to store and a few small attributes to describe.

## Proposal

### The format today

This section describes version 2, the format as NEMAR serves it today.
The full text is [`spec/index.md` at tag `2.0.0`](https://github.com/nemarOrg/biosig-zarr/blob/2.0.0/spec/index.md).

A store holds one recording as a Zarr version 3 hierarchy:

```
<name>.zarr/                  root group
  zarr.json                   root attributes
  <modality>_<rate>hz/        one channel group per modality and source rate
    zarr.json                 group attributes, including channels[]
    0/                        level 0: signal, shape [n_channels, n_samples], sharded
    view/
      1/, 2/, ...             minimum and maximum envelopes, for drawing only
  events/
    onset/, duration/, code/  present when the recording has events
```

A store is derived from a source recording, and the source stays the record of what was acquired.

A store is lossy by default.
Signals above a rate cap per modality are resampled down to the cap through an anti-alias filter, and never upsampled;
NEMAR uses 250 Hz for EEG and MEG, and 1000 Hz for iEEG and EMG.
Samples are stored as 16-bit integers with a `scale` and `offset` per channel.

Level 0 is channels first.
It has shape `[n_channels, n_samples]`, and every chunk spans every channel, so one request returns a time window of the whole montage.

A reader can find every path from the attributes, without listing the store,
because a store served over the Hypertext Transfer Protocol (HTTP) usually cannot be listed.

The `events` group is light.
It holds onset, duration, a code and a label per code, like a data file's own annotations.
Full event tables, with Hierarchical Event Descriptors (HED), stay in the dataset.

A distributed store holds no subject information, meaning no identity or phenotype fields.

A publisher documents its own restrictions and additions as a profile.
NEMAR's is the only profile today, with 16-bit storage always, fixed rate caps and a `nemar` provenance block.

Four parts of the `2.0.0` text run ahead of any implementation and are marked **Proposed** there:
the name `biosig-zarr` inside stores, the `.bzx` form, the `generated_by` attribute, and the conformance classes.
Its "Status of this document" section says "Three parts" and then lists four; the version 3 text corrects the count.
The `2.0.0` text was moved from docs.nemar.org word for word, so it still calls itself "this page",
and its open question 33 still says the text stays on docs.nemar.org until beta.
That direction is superseded: the text lives in nemarOrg/biosig-zarr from 2026-11-20 (nemar-cli Architecture Decision Record (ADR) 0131).

### Part A: the time model (`format_version` 3)

Three different things at NEMAR carry the number 3, and only one of them is this proposal.
`format_version` 3 here is the version of a single store.
NEMAR's dataset index, `index.json`, has its own `format_version`:
indexes written by NEMAR's current conversion engine are version 3, while about half the catalog still publishes index version 1,
and either way it describes the index, not the stores.
NEMAR's conversion engine has its own version number too (nemar-cli ADR 0033), which says which build of the converter produced a store.

Everything in the two parts of this proposal is put up for comment.
NEMAR settled the position it brings to the RFC in twelve design decisions on 2026-11-20, and comments can change any of them.

In this proposal, the key words MUST, MUST NOT, SHOULD, SHOULD NOT and MAY are used as Best Current Practice 14 (BCP 14) defines them,
in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174), when, and only when, they appear in capitals, as in the specification text.
RFC 2119 and RFC 8174 are documents of the Internet Engineering Task Force (IETF), separate from NEMAR's RFCs.

Version 3 is not only for future data.
Gaps (EDF+D, FIF skips, BrainVision segments) and source resolution affect data NEMAR already holds,
while the `timestamped` group kind gives a home to data that BIDS does not carry yet.

#### One timeline per store

- A store has one **recording timeline**, in seconds, as 64-bit floating point.
  Time 0 is the instant the source file's own clock calls its start.
- `events/onset` values are on this timeline, and gaps count.
  An event after a 30-second pause has an onset 30 seconds later than its position in the concatenated samples.
- Every uniform group has a required `start_time`: the time of its sample 0 on the timeline.
  It lets streams that started at different times share one timeline, and a source cut from a longer session keep its own clock.
- An optional root attribute `origin_source_time` holds the value of the source's own clock at time 0, for sources that have one, such as the LSL clock in XDF.
  With it, a reader can restore source timestamps exactly.
- The absolute date and time of the origin stays open (version 2 open question 10).
  It is a privacy question more than a timing one.

#### Identification

A version 3 writer MUST write `format_version` 3 and the format name `biosig-zarr` on every store.
It also writes a root attribute `zarr_conventions` that declares the store under the Zarr conventions mechanism with the biosig-zarr convention's fixed identifier;
like the name, this attribute is marked Proposed in the text, and its shape is question 5.

#### Two kinds of group

Every group carries a required attribute `kind`:

| `kind` | Meaning | Listed in root attribute |
| --- | --- | --- |
| `uniform` | One sample grid; sample `i` lies at `start_time + i / rate`. | `channel_groups` |
| `timestamped` | One explicit time per sample. | `timestamped_groups` |

`channel_groups` keeps its name and its version 2 meaning, so a reader that navigates by it never lands on a group it cannot read.

#### Gaps stay on the grid: `valid_intervals`

A `uniform` group is the version 2 channel group plus these required attributes:

| Attribute | Type | Meaning |
| --- | --- | --- |
| `kind` | string | `"uniform"`. |
| `start_time` | number | The time of sample 0 on the recording timeline, in seconds. |
| `valid_intervals` | array of objects | Where acquired samples exist. Never empty. |
| `time_regularization` | object or `null` | `null` when the source declared uniform sampling; otherwise how timestamps were placed on the grid (see "Jittered streams"). |
| `rate` | number | The exact served rate, never rounded. |

Each interval has `start` (first sample index), `stop` (one past the last), and `source_time` (the time of its first sample as the source states it, or `null`).

- A continuous recording has exactly one interval.
  A store therefore states continuity, instead of implying it by saying nothing.
- When `source_time` is a number, `start` MUST equal `round((source_time - start_time) * rate)`;
  the placement error, at most half a sample period, follows from the two numbers.
- A sample outside every interval was never acquired, and a reader MUST NOT return it as data.
- A writer MUST NOT write a chunk that lies wholly inside a gap.
  Zarr reads an absent chunk as the fill value, so a gap of any length costs no storage.
- `source_time: null` means the order is known and the elapsed time is not,
  as with a BrainVision "New Segment" marker with no date, an EEGLAB `boundary` event, or concatenated runs.
  The interval is placed directly after the previous one.
  Grid times from there on are a convention, and a reader that reports them MUST say so.
- A reader MUST NOT filter, resample, epoch or interpolate across an interval boundary.
  A writer MUST resample each interval on its own.
- A writer SHOULD NOT write more than 65,536 intervals in a group; a signal more fragmented than that is a `timestamped` signal.

An EDF+D recording with 19 channels at 250 Hz, recorded from 0 to 60 seconds and again from 90 to 240 seconds, has these group attributes
(illustrative numbers; attributes not shown are unchanged from version 2):

```json
{
  "kind": "uniform",
  "modality": "EEG",
  "rate": 250.0,
  "n_channels": 19,
  "n_samples": 60000,
  "start_time": 0.0,
  "valid_intervals": [
    { "start": 0, "stop": 15000, "source_time": 0.0 },
    { "start": 22500, "stop": 60000, "source_time": 90.0 }
  ],
  "time_regularization": null
}
```

With 1,000-sample chunks, chunks 15 to 21 do not exist, and chunk 22 holds 500 filler samples followed by 500 valid ones.

#### A declared missing value

Every signal array carries a required attribute `missing_value`: the stored value that means "no sample here".

| Data type | `missing_value` | Data codes |
| --- | --- | --- |
| `int16` | `-32768` | `-32767` to `32767`: 65,535 codes, 65,534 steps. |
| `int32` | `-2147483648` | `-2147483647` to `2147483647`. |
| `float32`, `float64` | `"NaN"` | Every value that is not NaN. |
| any | `null` | Every stored value is data (allowed only for a bit-exact copy; see "Bit-exact copies"). |

- When `missing_value` is not `null`, the array's Zarr `fill_value` MUST equal it, so an absent chunk decodes to missing.
- A reader MUST return a missing sample as missing (NaN, a mask, or a range list), never as `missing_value * scale + offset`.
- In an integer array, a writer MUST store a non-finite source sample as the missing value.
  This replaces the version 2 behavior and closes its open question 6 for integer stores, because the replaced samples can now be located.
  A floating point array keeps NaN, which is its missing value, and keeps infinities as they are;
  in both kinds of array the channel counts its non-finite samples and is marked unfit for inference.
- `valid_intervals` describes the acquisition (the recorder was off),
  and `missing_value` describes one channel at one sample (a sensor off, a dropped packet).
- NEMAR's profile always reserves the code.
- Reserving `-32768` changes the version 2 quantization.
  Version 2 maps each channel's physical range onto all 65,536 `int16` codes, with `offset = pmin + 32768 * scale`;
  version 3 maps it onto the 65,535 codes from `-32767` to `32767`, so `scale` grows by a factor of 65,535/65,534 and `offset` moves to the middle of the range.

#### Jittered streams: kept as measured by default

The format permits two homes for a stream with a nominal rate and a timestamp per sample.
The first keeps the stream as measured, in a `timestamped` group with `nominal_rate` set, and loses nothing about timing.
The second regularizes it, in a `uniform` group whose `time_regularization` records the method (`index_order` or `interpolated`), the nominal and effective rates, and the largest and root mean square timing error in seconds.
When values were interpolated, every channel says so in its `derivation` list (see "Every lossy step is recorded").

NEMAR's profile keeps such streams as measured by default, and regularizes only on request, with the error recorded.

#### The `timestamped` kind

A `timestamped` group holds an irregular signal, a sparse signal with a value, or a jittered stream kept as measured.
An EDF+D file whose records have duration 0, one sample per ordinary signal each, maps here: each record's timestamp becomes one entry of `time`.

```
<name>/                 group, kind "timestamped"
  zarr.json             group attributes, including channels[]
  time/                 float64, shape [n_samples], seconds on the recording timeline
  values/               shape [n_channels, n_samples]
  time_index/           float64, shape [n_chunks]: the first time of each chunk
```

- It MUST NOT have an array named `0`, a `rate` attribute or a `view` group.
- Sample `i` of every channel in the group was taken at `time[i]`; channels that do not share timestamps MUST go in separate groups.
- `values` has the group's storage type (the group's own `dtype`, else the root `dtype`; see "Part B"),
  and carries `scale`, `offset`, `missing_value` and `physical_formula` with the meanings they have on level 0.
- `nominal_rate` is the rate the source declared, or `null`.
  `effective_rate` is informative; a reader MUST NOT compute sample times from it.
- `continuity` is `"continuous"`, `"step"`, `"instantaneous"` or `"unknown"` (the names follow NWB), and a reader MUST NOT interpolate a group that is not `"continuous"` without saying so.
- The `time` array carries its own `derivation` list, from a second closed vocabulary: `clock_synchronized`, `dejittered`, `deduced`, `sorted`, or empty when the values are the source's own timestamps shifted to the origin.
  It is separate from the channels' list because it describes the timestamps, not the samples; question 28 covers both.
- A window read fetches `time_index` (one request), searches it, and fetches the matching `time` and `values` chunks.
- The `time` array costs 8 bytes per sample before compression.
  For a 64-channel 16-bit stream that is 6.25% on top of the values; for a 4-channel stream it is 100% (arithmetic; the effect of compression was not measured).
- A point process with no value, such as a marker, is an event and goes in `events`.

A cuff blood pressure taken about every five minutes beside a four-hour EEG recording (illustrative; `channels[]` omitted):

```json
{
  "kind": "timestamped",
  "modality": "MISC",
  "n_channels": 2,
  "n_samples": 47,
  "nominal_rate": null,
  "effective_rate": 0.0033,
  "time_range": [212.4, 14162.9],
  "continuity": "instantaneous",
  "chunk_samples": 1000
}
```

The root then lists `"channel_groups": ["eeg_250hz"]` and `"timestamped_groups": ["bp_cuff"]`.

#### Four layers of reader safety

No single omission should let a reader misread.
That is not yet true for NEMAR's own readers.
A `uniform` group with gaps or a declared missing value is laid out exactly like a version 2 group,
and NEMAR's server-side read path checks the version of the dataset's `index.json`, not the `format_version` of each store (checked in its source on 2026-11-20),
so without a change it would return the filler in a gap as data.
For that reason this RFC adds a rollout rule (see "Rollout and cost"): every NEMAR reader refuses a store whose `format_version` is above 2 before the first version 3 store reaches the serving bucket,
and the dataset index records each store's `format_version`.

Each layer is a refusal rule that a conformance case can test: the case passes when the reader refuses with an error that names the feature, and fails when the check is removed.

1. **Version.**
   A reader MUST refuse a store whose `format_version` is above the highest it implements.
   biosigIO's reader has refused a newer version since release 0.6.0 (checked in the source of 0.6.0 and 1.2.13 on 2026-11-20), so every deployed biosigIO release refuses a version 3 store;
   it also refuses the name `biosig-zarr`, which version 3 writers write.
2. **Kind.**
   A reader MUST read a group's `kind` before any array of the group,
   MUST refuse a group whose `kind` it does not implement, and MUST refuse a group of a version 3 store that has no `kind`.
   A reader MUST NOT infer a kind from a group's name or from which children it has.
   A new kind MUST increase `format_version`.
3. **Structure.**
   A writer MUST NOT name a `timestamped` group in `channel_groups`, and a `timestamped` group MUST NOT have an array `0`, a `view` group or a `rate` attribute.
   A reader that opens a group as uniform MUST refuse it when its `0` array or its `rate` attribute is absent, and MUST NOT substitute a default for either.
   So a reader that skips the first two layers and navigates by `channel_groups` never reaches a `timestamped` group,
   and one that opens such a group anyway gets an error instead of wrong times.
   This layer exists because some deployed readers check neither the format name nor the version; NEMAR's server-side read path is one.
4. **Within a uniform group.**
   A reader that does not implement `start_time`, `valid_intervals` or `missing_value` MUST refuse a group where that attribute is in effect, with an error that names it.
   `start_time` is in effect when it is not 0.
   `valid_intervals` is in effect when it holds more than one interval, or when any interval's `source_time` is `null`.
   `missing_value` is in effect when it is not `null` on level 0.

When the RFC opens, the conformance suite in nemarOrg/biosig-zarr has at least one such case for each of the four layers.

#### Events and the onset-to-sample rule

- For a `uniform` group, the sample nearest an onset is `i = floor((onset - start_time) * rate + 0.5)`.
  If `i` falls outside the array, or the onset falls outside the acquired time of every valid interval (below), the event has no sample in that group, and a reader MUST say so instead of clamping.
  An event with no sample keeps its onset.
  This closes version 2 open question 16.
- The acquired time of an interval is the half-open span `[t, t + (stop - start) / rate)`,
  where `t` is its `source_time`, or `start_time + start / rate` when `source_time` is `null`.
  A reader MUST test the onset against this span, not only test `i` against `[start, stop)`, because placing an interval on the grid can round its first sample onto a grid point earlier than its source time.
- For a `timestamped` group, it is the first `i` with `time[i] >= onset`.
- The `events` group gains a required attribute `onset_source_basis`:
  `"timeline"` (the source gave onsets on the recording timeline, as EDF+ annotations do),
  `"concatenated"` (the source counted onsets in gap-free samples and the writer mapped them through `valid_intervals`),
  or `"unknown"`.
  With more than one interval, a reader needs this attribute to align events correctly.

A required conformance case tests the span rule.
A uniform group at 10 Hz has `start_time` 0 and two intervals: `{ "start": 0, "stop": 20, "source_time": 0.0 }`, acquired from 0.00 to 2.00 seconds,
and `{ "start": 20, "stop": 40, "source_time": 2.04 }`, placed at grid index `round(2.04 * 10) = 20`, so there is a known acquisition gap from 2.00 to 2.04 seconds.
An event at 2.02 seconds keeps its onset of 2.02 seconds, and a reader MUST return no acquired sample for it,
even though `floor(2.02 * 10 + 0.5) = 20` is a valid grid index inside the second interval.

#### How source features map

| Source feature | In a version 3 store |
| --- | --- |
| Uniform continuous file | One `uniform` group per modality and rate; one interval. |
| EDF+D, BDF discontinuous | Intervals from the record start times; `source_time` set. |
| EDF+D with records of duration 0, one sample per ordinary signal | `timestamped`, one `time` entry per record. |
| BrainVision "New Segment" markers | One interval per segment; `source_time` from the marker's date, else `null`. |
| FIF data skips, MEF3 gaps | Intervals from the skip or block table; a reader library's zero fill is not stored as data. |
| EEGLAB `boundary` events, concatenated runs | Adjacent intervals with `source_time: null`. |
| Signals at different rates | One `uniform` group per rate (as in version 2). |
| Streams that start at different times | `start_time` per group. |
| XDF stream with a nominal rate | `timestamped` with `nominal_rate`, or `uniform` with `time_regularization`. |
| XDF stream with nominal rate 0, numeric | `timestamped`, `nominal_rate: null`. |
| XDF string marker stream | `events`. |
| Per-sample time vectors (BIDS motion `LATENCY` channel, BIDS physiology `timestamp` column) | The group's `time` array. |
| Sensor-off codes | `missing_value`. |

The design behind this RFC also maps the General Data Format for biomedical signals (GDF), the Waveform Database format (WFDB) and the Shared Near Infrared Spectroscopy Format (SNIRF).
Those mappings come from the formats' documentation and have not been tested against files, so they stay out of this table; commenters who hold such files are asked to test them (question 18).

#### Epoched sources

A source that holds only cut trials has no continuous timeline to restore.
The format can express it as adjacent intervals with `source_time: null`.
NEMAR's profile refuses epoched sources for now, and question 21 asks whether the format should accept them.

#### The back catalog

- Version 2 stores stay readable, as version 2.
  A reader treats a version 2 group as `uniform`, starting at 0, with one interval and no declared missing value, and SHOULD tell its user that continuity is not recorded.
- NEMAR re-converts old stores from their sources through its normal conversion queue, starting with recordings whose source can be discontinuous.
- A store MUST NOT be changed from version 2 to version 3 by editing its metadata, because that would assert one valid interval without checking the source.
- The rename of the format tag from `biosigio-zarr` to `biosig-zarr` follows the same rule (nemar-cli ADR 0131):
  no store is patched in place, the version 3 writer writes the new name, and existing stores keep the old name until they are re-converted.
  Readers accept both names, permanently.

### Part B: sample resolution

#### The store side: what the existing fields mean

No new store-side field is proposed; the text defines what the existing ones mean.
This is a deliberate choice: `dtype` already is the storage resolution (width and integer or floating point), `scale` already is the store's step,
and the new `source_*` fields below, including `source_sample_type` and `source_adc_bits`, state the source's resolution explicitly.
A separate bit-depth attribute on the store side would repeat `dtype`; question 39 asks whether the store should carry one anyway.

Root `dtype` is the storage type, and it stays REQUIRED.
Its name gives the width in bits and whether the type is integer or floating point.
It is the store default; a group MAY carry its own `dtype`, and every signal array's Zarr `data_type` MUST equal the resolved value.

The closed list of storage types becomes `int16`, `int32`, `float32`, `float64`, for uniform and timestamped groups alike.
`int32` gives 24-bit sources a home without requantization, and `float64` does the same for double-precision sources.
Zarr version 3 has no 24-bit integer type.
A signal reader MUST support `int16`, and MAY refuse another type with an error that names it.
NEMAR's profile stays `int16` for uniform groups.

For an integer type, `scale[c]` is the store's quantization step for channel `c`, its resolution in the channel's unit:
one digital step, with a maximum error of half a step on a requantized sample.
For a floating point type, `scale` is 1, `offset` is 0, and the resolution is that of the type.
`physical = digital * scale + offset` is unchanged.

#### The source side: five new fields

| Field | Where | Type | Meaning |
| --- | --- | --- | --- |
| `source_sample_type` | root (REQUIRED), channel (OPTIONAL override) | string | The type of a decoded sample in the source: `int<N>` or `uint<N>`, `float32`, `float64`, or `"n/a"`. A BDF file is `int24`. |
| `source_adc_bits` | root (REQUIRED), channel (OPTIONAL override) | integer or `null` | The bit depth of the analog-to-digital converter (ADC), only when the source states it. Never inferred from the sample type. |
| `source_step` | each channel (REQUIRED) | number or `null` | One source digital step in the channel's unit: the source's resolution. `null` for a floating point source. |
| `source_offset` | each channel (REQUIRED) | number or `null` | The physical value of source digital code 0. |
| `source_digital_range` | each channel (REQUIRED) | `[min, max]` or `null` | The digital minimum and maximum the source declares. |

- The first two are REQUIRED at the root, where `"n/a"` and `null` are allowed.
  A channel's own value, when present, overrides the root's.
  The channel value replaces the root value instead of multiplying it, because these fields are facts, not gain factors.
- The other three are REQUIRED on every channel, where `null` is allowed.
- The source's physical range is not stored, because it follows from the three per-channel fields.
- The storage width and the converter depth are separate fields because a 16-bit converter can sit in a 24-bit file.

A BDF channel recorded at 1024 Hz, capped to 250 Hz and requantized into a 16-bit store, whose physical values after resampling span -2000 to 2000 microvolts
(illustrative; unchanged members omitted):

```json
{
  "label": "A1",
  "unit": "uV",
  "original_rate": 1024.0,
  "target_rate": 250.0,
  "scale": 0.061037,
  "offset": 0.0,
  "source_step": 0.03125,
  "source_offset": 0.0,
  "source_digital_range": [-8388608, 8388607],
  "derivation": ["resampled", "requantized"]
}
```

with `"source_sample_type": "int24"` and `"source_adc_bits": null` at the root.
`scale` is 4000/65,534 microvolts, about twice `source_step`,
so a reader sees at once that this store is about one bit coarser than its source.

#### Bit-exact copies

When a channel is not resampled, not unit-converted, and the store's integer type holds the source's codes, a writer MAY copy the codes unchanged:
`scale` equals `source_step`, `offset` equals `source_offset`, and `derivation` is empty.
An EDF file at or below the rate cap can then be reproduced bit for bit.
If the source uses the type's most negative code as data, the array declares `missing_value: null`.

The format allows this.
NEMAR will decide whether its writer does it after measuring how many recordings qualify.

#### Every lossy step is recorded: `derivation`

Each channel carries a REQUIRED list `derivation`, in the order the steps were applied, from a closed vocabulary:

| Token | Meaning |
| --- | --- |
| `resampled` | Rate changed through an anti-alias filter. |
| `nearest_sample` | Rate changed by picking the nearest source sample (discrete channels). |
| `time_interpolated` | Values computed at grid times from timestamped samples. |
| `unit_converted` | Multiplied by a unit factor. |
| `requantized` | Stored integer codes are on a new lattice, not the source's codes. |
| `narrowed` | Stored at lower floating point precision than the source. |
| `nonfinite_to_missing` | Non-finite source samples stored as the missing value. |
| `nonfinite_zeroed` | Non-finite samples stored as physical zero. Version 2 stores only. |
| `gap_filled` | Samples at times the source did not record are stored as data. Only for sources whose reader fills silently. |

- An empty list means the stored codes are the source's codes.
- A profile MAY add tokens that contain a colon, such as `nemar:sss`; a reader MUST treat an unknown token as "derived, in a way I do not know".

#### NEMAR's content digest

NEMAR keys derived results on a digest of a store's level-0 values (nemar-cli ADR 0123, proposed, digest `nemar.store-content.v1`).
That digest has no notion of a missing sample, an interval or a time array.
NEMAR will define a second version of it before keying any derivative on a version 3 store.
The digest is NEMAR's own machinery and not part of the format, but readers should know the dependency exists.

### The single-file form, `.bzx`

A directory-form store is thousands of small objects.
The packaged form holds the same store in one file.

- A `.bzx` file is a ZIP archive that holds exactly one biosig-zarr store, with the store's root at the archive's root.
- The root `zarr.json` is the first entry, and the first entry in the central directory.
- Every entry is stored without ZIP compression, because chunks are already compressed by their Zarr codecs.
- Every entry is byte-identical to the corresponding object of the directory form,
  so a byte range inside an entry maps to a byte range of the file, and packing changes no chunk and no metadata.
- The archive always uses the ZIP64 extension.
- The ZIP archive comment carries the format name and `format_version`, so a reader can identify the file without opening an entry.
  Version 3 proposes that a reader can also refuse a version it does not implement from the comment alone; that depends on the comment's encoding, which is question 10.
- A `.bzx` file holds no other `.bzx` file and no other zipped Zarr hierarchy.
- A `.bzx` file is written once; a changed store is packed again.
- Because every entry is stored and byte-identical, a reader can map a chunk to a byte range of the file and read a remote `.bzx` with HTTP range requests (question 14).

Version 3 changes no packing rule, because `time`, `values` and `time_index` are ordinary arrays.
A never-written chunk has no entry.
A packer must not create one, and an unpacker must not treat its absence as damage.

### Why the format and the package have separate names

The store and its package are two layers that can change separately.
`biosig-zarr` names the store and defines what its groups, arrays and attributes mean,
whether the store is a directory, an object-storage prefix, or the inside of an archive.
`.bzx` names the packing of one store into one file (entry order, no compression, the archive comment), and says nothing about what a sample means.

The package-specific items are up for comment for four reasons.

First, the commenters differ.
People who record and use biosignals of every kind, from EEG and MEG to physiology and wearables, care what a store says about a recording,
and people who build Zarr tools care whether the archive can be read in place.
This RFC addresses the whole biosignal community, not only EEG and MEG; separate names let each group find its part.

Second, the names themselves can mislead.
One file-extension listing, [file.org](https://file.org/extension/bzx), names a user-suggested Windows program, Radan, for `.bzx` (checked 2026-11-20).
BioSig is a long-standing open-source library for biomedical signals, so `biosig-zarr` could be read as its Zarr backend, which it is not.

Third, a `.bzx` snapshot of a BIDS dataset changes the files around the package.
NEMAR's planned download command writes a copy of the BIDS tree with each data file swapped for a `.bzx`,
and rewrites the sidecar fields that depend on the rate mechanically to match the store.
NEMAR's dataset-level events table, `events.parquet`, is never packed.
The events group inside the package stays light, and the full events stay in `events.tsv`.
Question 17 asks what `SamplingFrequency`, `RecordingType` and `RecordingDuration` should then say for a discontinuous or timestamped recording.

Fourth, the two layers need a versioning rule.
Should a fix to the packing rules raise `format_version`?
We recommend that one `format_version` cover both, because the archive comment already carries it and a reader should have one number to check.

### What NEMAR's profile will do

The format permits more than NEMAR will use, and the table separates the two.

| Choice | Format | NEMAR's profile |
| --- | --- | --- |
| Storage type | `int16`, `int32`, `float32`, `float64` | `int16` for uniform groups |
| Missing value | Reserved code, or `null` for bit-exact copies | Always reserved |
| Jittered streams | As measured, or regularized | As measured; regularized only on request |
| Bit-exact copy | Allowed | Undecided until measured |
| Epoched sources | Expressible | Refused for now |
| Rate caps | A writer parameter, recorded | 250 Hz for EEG and MEG; 1000 Hz for iEEG and EMG |

### The verdict, if accepted

biosig-zarr `format_version` 3, with group kinds, `valid_intervals`, a declared missing value, per-channel `derivation` and source-resolution fields, and with `.bzx` as its single-file form under NEMAR's own packing rules, is adopted as specification release `3.0.0`.

## Who is affected

- **People who record or deposit biosignals** gain a home for paused, jittered and sparse recordings, and a store that says what was done to their samples.
- **People who use NEMAR's data** get stores that state continuity and source resolution, once their recordings are re-converted;
  until then, version 2 stores keep working.
- **Tool builders** get a written contract, test vectors and a single-file form to implement, instead of one library's behavior to copy.
  A reader that supports version 2 needs work to support version 3; one that does not is protected by the four layers above.
- **biosigIO** gains a version 3 writer and reader.
- **NEMAR** changes its readers before serving any version 3 store, then re-converts its catalog through the normal queue.

## What does not change, and what is irreversible

What does not change:

- Version 2 stores stay readable as version 2, and readers accept both format names permanently.
- The directory form's layout for a continuous, uniformly sampled recording keeps its groups, arrays and dequantization formula; it gains attributes.
- Everything under "Decided, and out of scope for comment" below.

What cannot be undone once done:

- A store written as version 3 and served is in people's hands; a later change to its meaning needs a new `format_version`, never an edit.
- A `.bzx` file is written once, so a packing rule, once files circulate, can only be changed by a new version.
- Once accepted, the `3.0.0` text is a release; corrections go into a later release, never into the tag.

### Decided, and out of scope for comment

Each item below is closed, and the table names the record that closed it.
Arguments that one of these was decided wrongly are still welcome as issues; they will not change the outcome of this RFC.

| Decided | Record |
| --- | --- |
| A store is not an NWB container and will not be made NWB-conformant; any NWB output is a stateless export. | nemar-cli ADR 0128, Decision. |
| One package holds one recording. It is an alternative to a data file, not to a dataset. | ADR 0128, Context and Consequences; the specification, "Scope and non-goals". |
| The license model: specification text under the World Wide Web Consortium (W3C) Software and Document License; schemas, test vectors and code under the Apache License 2.0. | ADR 0128, Consequences; ADR 0131, Decision 1; neuromechanist/biosigio issue 179. |
| The specification lives in nemarOrg/biosig-zarr, and the `.bzx` packing rules are NEMAR's own, not a dependency on OME-Zarr RFC-9. | nemar-cli ADR 0131, Decisions 1 and 2. |
| No store's metadata is patched in place; the tag rename arrives through re-conversion. | ADR 0128, "One copy, and how drift is refused"; ADR 0131, Decision 3. |

Two packaging rules that earlier drafts listed here have no decision record, so they are open for comment with the rest of the proposal (question 8):
entries stored without ZIP compression and byte-identical to the directory form,
and a package written once and never edited in place.
How NEMAR's own download command builds packages (planned in nemar-cli issue 2216 to run on the researcher's machine, with nothing stored on NEMAR's servers, and to rewrite the sidecars) is a choice about NEMAR's tool, not about the format, and is outside this RFC.

## Options considered

The design behind this RFC weighed twenty alternatives.
The table gives the ones a commenter is most likely to propose, with the reason each was not chosen.
Doing nothing means version 2 as it stands: gaps, jitter and sparse signals have no home, and the gap defect described under "Problem" goes on unseen.

| Alternative | Why it was not chosen |
| --- | --- |
| Postpone irregular signals to a later version | The format is not final; postponing only moves the break. A version bump, a required `kind` and the structural guard protect today's readers. |
| Add the features to version 2 as optional attributes | A version 2 reader would ignore `valid_intervals` and return filler as data: a silent misread. |
| Store samples gap-free with a segment table | A reader that skips the table misplaces every sample after the first gap, silently; that is the defect described under "Problem" made into a feature. On the grid, a reader that skips `valid_intervals` still has correct times. |
| One explicit time array for every group | 8 bytes per sample everywhere, a search before every window read, and no reader in the MNE family can represent it. Kept only where the data needs it. |
| A validity mask array per group | An array as large as a channel, for information that is a short interval list in almost every case. |
| NaN only, with floating point stores for anything with gaps | Doubles storage for 16-bit stores and excludes thin integer-only readers. |
| Always reserve an integer code, with no `null` | Makes bit-exact copies of full-range integer sources impossible. |
| Sparse signals inside the `events` group | A value with a unit, a scale and a missing value is a signal; `events` stays light. |
| Integer ticks with a tick rate for `time` | Exact, but one more conversion every reader must get right. Seconds in 64-bit floating point match `events/onset`, BIDS, XDF and NWB. |
| `valid_intervals` as Zarr arrays | Scales further, but costs a request on every window read and hides the gaps from someone reading `zarr.json`. |
| One store per continuous segment (the answer given in BIDS issue 1771) | A store stands in for one data file; splitting it changes the file list of a dataset. |
| A `resolution` field for the store side | It would always equal `scale`. |
| A single "bit depth" field | Merges storage width and converter depth, which differ. |
| Free-text processing provenance | Cannot be tested; a closed token list can. |
| Names from the Climate and Forecast (CF) conventions (`scale_factor`, `add_offset`, `_FillValue`) | Not rejected on merit; it renames deployed attributes, so it is question 20. |
| For the package: a plain `.zarr.zip`, reusing `.ozx`, or tar | A plain zip has no rules to validate against; `.ozx` promises an OME-Zarr data model the store does not have; tar has no index for reads in place. |
| NWB on Zarr as the store | See "Why not NWB on Zarr" below. |

### Why not NWB on Zarr

NWB has a Zarr backend, [`hdmf-zarr`](https://nwb.org/tools/core/hdmf-zarr/), built on the Hierarchical Data Modeling Framework (HDMF).
It is a great tool.
It puts the whole NWB data model, with typed objects, links and a schema, on cloud object storage.
A laboratory that keeps each session's full record in NWB should use it.

Our data has a different shape.
NEMAR serves human, low-frequency biosignals organized around signal files that follow BIDS principles:
one data file per recording, with its metadata in sidecar files beside it.
An NWB file is a container that holds its metadata inside.
A store stands in for the data file and leaves the sidecars where they are, as the record.

nemar-cli ADR 0128 ("The Zarr serving copy is not an NWB container", accepted 2026-11-18) gives three reasons.

First, the scope differs.
An NWB file is the archival record of a whole session.
A store holds one recording's normalized signal, and the BIDS dataset around it is the record.
To conform, a store would need session, subject and device fields that we leave out on purpose, and it would duplicate metadata that BIDS already holds.
Two copies of metadata that can change will drift apart.

Second, the layouts do not match.
NWB stores a time series time-first, with one conversion factor and offset for the series.
Our stores are channels-first, with a scale and offset per channel.
NWB also links typed objects by reference, caches its schema in the file, and uses compound types that need Zarr's extension data types.
Its consolidated metadata would go stale every time NEMAR rewrites a store on re-conversion.

Third, the NWB Zarr specification was still moving.
On 2026-11-18 the maintainers described the backend as under development,
a recent release had switched to a layout that older readers cannot open,
and validation of Zarr files was incomplete.
Those facts will change, so check them again before relying on them.

What NEMAR does instead is export.
NEMAR would build NWB output on request from the store and the BIDS dataset at a known commit, and would never keep it as a second stored copy; no such export exists yet.
To keep that export simple, the dequantization formula matches NWB's `conversion` and `offset`, given per channel,
and event columns follow BIDS and HED, which the `ndx-hed` extension maps onto NWB.
The `continuity` vocabulary proposed for `timestamped` groups is NWB's.

ADR 0128 says NEMAR revisits the decision when any two of these hold:
a named user needs NWB and has a concrete tool that reads it;
the Distributed Archives for Neurophysiology Data Integration (DANDI) accepts Zarr NWB uploads and the NWB Inspector validates Zarr;
`hdmf-zarr` is no longer marked as under development;
MNE-Python can read and write NWB;
NWB gains core types for scalp EEG or MEG.
Revisiting means building the export, not changing the store.

The decision itself is settled (see "Decided, and out of scope for comment").
We ask for comment on whether its reasoning is fair and current, and on what an export would need to be useful (questions 33 to 35).

## Prior art

### Relation to OME-Zarr RFC-9

[OME-Zarr RFC-9](https://ngff.openmicroscopy.org/rfc/9/) proposes a zipped form of OME-Zarr with the suffix `.ozx`.
We credit it as prior art for `.bzx`, not as a dependency (nemar-cli ADR 0131).

Our packing rules are our own text, and they do not follow later changes to RFC-9.
We see that independence as an advantage.
RFC-9 was at stage R4 ("authors reply to reviews"), not accepted, when checked on 2026-11-20 (its source front matter reads `manual_status: R4`), and it phrases most of its rules as recommendations.
A format that people archive data in needs fixed rules on a known date, and requirements a validator can test.
If RFC-9 changes, a `.bzx` file written today stays valid.
The cost is that NEMAR owns every future change to the packing rules, with nobody upstream to share the work.

The RFC-9 column below was checked against RFC-9's source on 2026-11-20.

| RFC-9 rule | RFC-9 strength | In `.bzx` |
| --- | --- | --- |
| Exactly one hierarchy per archive | Required | Adopted: exactly one biosig-zarr store. |
| Archive root is the hierarchy root | Required | Adopted. |
| Not embedded in a parent hierarchy | Required | Adopted, and widened: no `.bzx` and no other zipped Zarr hierarchy inside. |
| No archives split into parts | Required | Not adopted yet; question 9. |
| ZIP64 | Recommended | Strengthened to a requirement, at any size. |
| No ZIP compression | Recommended | Strengthened to a requirement. |
| Sharding | Recommended | Changed: level 0 must be sharded; view arrays are not. |
| Root `zarr.json` first | Recommended | Strengthened to a requirement. |
| Other `zarr.json` entries next, breadth first | Recommended | Not adopted yet; question 9. |
| Suffix `.ozx` | Recommended | Changed: `.bzx`. |
| Archive comment holding a version under an `ome` key | Recommended | Changed: the comment must carry the format name and `format_version`; its encoding is question 10. |
| Optional flag that metadata entries come first | Optional | Not adopted: the order is a rule, not a flag. |
| (none) | | Added: every entry byte-identical to the directory form. |
| (none) | | Added: written once, never modified in place. |

### Other prior art

- **EDF, EDF+ and BDF** are the contract the biosignal community already shares; biosig-zarr borrows their per-channel digital-to-physical mapping and their light annotations. EDF+D already carries gaps and, through records of duration 0, irregular samples; biosig-zarr keeps that timing explicit in a form that can be read in windows over a network.
- **NWB** supplies the `continuity` vocabulary and the shape of the dequantization formula; see "Why not NWB on Zarr".
- **BIDS** supplies the dataset around a store, and the threads cited under "Problem" record the same gaps from its side.
- **XDF** and LSL supply the model for jittered streams kept as measured, with clock corrections recorded.
- **The CF conventions** are the alternative naming that question 20 puts to commenters.

## Questions for commenters

Answer any subset.
A short answer with a real file behind it is worth more than a long one without.

**The format as a whole**

1. Is anything in the version 2 text ambiguous enough that two careful implementers would write different stores?
2. Sampling rates that are not integers are rounded in group names and grouping keys today (version 2 open question 5). Do you have recordings where that matters?
3. Should the core allow codecs other than blosc with zstd for level 0, at the cost of thin readers (open question 14)?
4. `unit`, `channel_type` and `modality` are free-form strings (open question 11). Which vocabulary would you want them bound to?
5. Should the format be declared as a registered Zarr convention in root attributes, and what should the declaration look like (open question 4)?
6. Should the absolute start time of a recording have a defined attribute, given that it can identify a person (open question 10)?
7. What would stop you from writing a reader in your language or tool?

**The package (`.bzx`)**

8. This proposal requires what RFC-9 only recommends (ZIP64 always, root entry first, entries stored without compression), and adds that every entry is byte-identical to the directory form and that a package is written once. Does any of that lock out a tool you rely on?
9. Should split archives be forbidden, and should all `zarr.json` entries precede chunk entries in breadth-first order (open question 27)?
10. What should the archive comment's encoding and shape be (open question 26)?
11. Should entry order, timestamps and attributes be fixed, so that two tools packing one store produce identical bytes (open question 28)?
12. Is a whole-file checksum, a digest manifest or a signature needed before `.bzx` files circulate, and where should it live (open question 24)?
13. Should the packing rules share `format_version` with the store, as recommended, or have a version of their own?
14. Do you need to read a remote `.bzx` over HTTP range requests, or only local files?

**Names**

15. Does `.bzx` collide with anything you use (open question 30)?
16. Is `biosig-zarr` likely to be confused with the BioSig library, and does that matter?

**Irregular and sparse series**

17. For a discontinuous or timestamped recording in a BIDS snapshot, what should `RecordingDuration`, `SamplingFrequency` and `RecordingType` say, and do your `events.tsv` onsets count gap time?
18. Are gaps on the grid, with a required interval list, acceptable as the only expression of discontinuity for uniform signals? Who has recordings where it fails (overlapping segments, clocks that step backward), and who can test the GDF, WFDB or SNIRF mappings against real files?
19. Should `valid_intervals` be an attribute with a cap of 65,536, or arrays? What is the most fragmented recording you have?
20. Should the format adopt CF attribute names and dimension names so that xarray decodes a store without help?
21. Is `source_time: null` (order known, elapsed time unknown) the right home for undated BrainVision segments, EEGLAB `boundary` events and concatenated runs? Should epoched data be accepted this way, or refused?
22. Should integer stores always reserve the most negative code, or is `missing_value: null` for bit-exact copies worth a second case in every reader?
23. For jittered streams, which should a public archive serve: timestamps as measured, or a regular grid with the error recorded? Is the largest absolute timing error the statistic you would check?
24. Are `timestamped` groups with one shared `time` array enough for your irregular data? Does anyone need a time per channel inside one group?
25. Is `continuity` (`continuous`, `step`, `instantaneous`, `unknown`) the right vocabulary, and should it also apply to uniform groups?
26. Are seconds in 64-bit floating point precise enough for `time`, or do you need integer ticks?
27. Should a writer be allowed to store a recording whose time base is unknown at all, or must it refuse?

**Resolution**

28. Are the two `derivation` vocabularies complete (the channels' list of lossy steps, and the `time` array's list of timestamp corrections), and is an empty list a claim you would rely on?
29. Should `int32` and `float64` be core storage types, and may a signal reader refuse them?
30. Should `source_adc_bits` exist when almost no EEG format states it?
31. Is the pattern `int<N>` and `uint<N>` right for `source_sample_type`, or should the list be closed?
32. Do `source_step`, `source_offset` and `source_digital_range` let you restore the source header of the formats you export to? Which format do they fail for?

**Why not NWB**

33. Is "Why not NWB on Zarr" a fair description of `hdmf-zarr` and NWB on Zarr today? What is out of date?
34. Would a stateless NWB export from a store be useful to you, and which tool would read it?
35. Are the revisit conditions the right ones?

**Reader safety, the timeline and events**

36. Are the four reader-safety layers enough, and is each one testable in your reader? Does any deployed reader you know of slip past all four?
37. Is one recording timeline with a `start_time` per uniform group the right model for streams that start at different times, and for a source cut from a longer session?
38. Is `onset_source_basis` (`timeline`, `concatenated`, `unknown`) enough to align events in a recording with gaps, and is the onset-to-sample rule, with its test against each interval's acquired time span, the rule you would implement?
**Resolution, continued**

39. Should a store also carry an explicit bit-depth attribute for its stored samples, beside `dtype` and `scale`, or is `dtype` enough?

## How the decision will be made

We write these criteria before comments open, so they cannot be fitted to the comments.
Who decides, the window and the clock are in [`PROCESS.md`](../PROCESS.md):
the owner of the NEMAR platform decides, the window is 21 days measured to the minute from `opened_at` in Coordinated Universal Time (UTC), and the opening post prints the exact close.
One extension of at most 14 days may be granted before the close, with a stated reason, so the window is never longer than 35 days.
Every comment gets a written disposition before the decision.

The window is short on purpose.
NEMAR welcomes review assisted by artificial intelligence (AI) when knowledgeable people use it and check what it produces,
and with that help a careful review fits in three weeks.
At most one NEMAR RFC is open for comment at a time, so this one has the community's full attention while it is open.

The proposal is accepted if all of these hold at the close:

1. No silent misread stands.
   Nobody has shown a class of real recording that a conforming version 3 reader would return with wrong times or wrong values without an error.
2. Every real recording offered has a home.
   Each recording a commenter brings is either expressible in version 3 or named in the text as refused, with the reason.
3. The refusals are testable.
   Each of the four reader-safety layers, and the onset rule's gap case, has at least one conformance case that fails when the check is removed;
   those cases are in nemarOrg/biosig-zarr, with the first vectors, when the RFC opens.
4. The package can be implemented from the text alone.
   Someone who did not write the text has confirmed that, or the gaps they found are closed.
5. No decided item was reopened by accident.
   Changes stay within what "Decided, and out of scope for comment" leaves open.

Acceptance does not require a working implementation:
the RFC opens and closes on the text, its schemas and a few real test vectors, with no packer.
An accepted text that changes after comments lists each change in its change log before it is tagged `3.0.0`.

## Rollout and cost

- Before any version 3 store reaches NEMAR's serving bucket, every NEMAR reader refuses a store whose `format_version` is above 2, and the dataset index records each store's `format_version`.
  This is a rollout rule, not a comment item.
- The `3.0.0-draft.1` text is revised from the comments and tagged `3.0.0`.
  The release gets a NEMAR Digital Object Identifier (DOI) through NEMAR's planned DOI registry.
- The specification decision is recorded in nemarOrg/biosig-zarr; NEMAR's profile and rollout decisions are recorded in nemar-cli, each linking this RFC.
- The conformance test files live in nemarOrg/biosig-zarr; NEMAR's own code vendors them by digest.
- biosigIO gains a version 3 writer and reader; NEMAR's readers gain the interval, start time and missing value rules.
- NEMAR re-converts its stores through the normal queue, recordings whose source can be discontinuous first, and states how long version 2 and version 3 stores coexist.
  The cost is the compute of a full re-conversion of the catalog, spread over the queue's normal time.
- Until then, biosigIO is to refuse discontinuous EDF+D and BDF+D sources with gaps ([neuromechanist/biosigio#180](https://github.com/neuromechanist/biosigio/issues/180)), so no new store repeats the shifted-samples defect.
- Version 2 stores stay readable throughout.

None of that work is part of this RFC, and none of it starts before the decision.

## History of the format

Version 3 builds on a format NEMAR has served for months, which is now becoming its own specification.
The dates come from the Git history and release tags of biosigIO and from NEMAR's decision records, not from estimates.

| `format_version` | Started | What it changed | Records |
| --- | --- | --- | --- |
| 1 | 2026-05-31 | The first Zarr serving format: channel groups per modality and rate, sharded 16-bit level 0 with a scale and offset per channel, a minimum and maximum view pyramid, a light events group. `recording_metadata` was a string holding JSON text. | biosigIO commit "Add Zarr serving-format exporter and reader" (`cfad838`), first released in 0.4.0, when the package was still named emgio. |
| 2 | 2026-05-31 | `recording_metadata` became a JSON object, so a browser reader needs no second parse; the reader began to check the version and refuse a newer one. | biosigIO commit "Consolidate serialization exports + add docs" (`be6f60d`), first released in 0.6.0. |
| 2, grown by addition | 2026-07-07 to 2026-10-05 | New attributes with no version change: the count of replaced non-finite samples (biosigIO 1.2.1, 2026-07-07); the declared view pyramid and chunk geometry (1.2.6, 2026-09-02); unit handling from BIDS `channels.tsv` (1.2.7, 2026-09-02); the subject-information exclusion mark (1.2.11, 2026-10-05). | The specification, "What changes the version"; biosigIO release tags. |
| 2, specified | 2026-11-18 | No change to stores. The layout was written down as a specification that implementations follow, named `biosig-zarr`, with `.bzx` proposed. | nemar-cli ADR 0128 (accepted 2026-11-18); the pre-beta specification on docs.nemar.org (nemarOrg/docs pull request 122). |
| 2, moved | 2026-11-20 | No change to stores or to the text. The text moved to nemarOrg/biosig-zarr and was released as `2.0.0`. | nemar-cli ADR 0131; nemarOrg/biosig-zarr release `2.0.0`. |
| 3 (proposed) | This RFC | The time model (group kinds, `valid_intervals`, `missing_value`, `start_time`) and source resolution (`source_*` fields, `derivation`). | This document; tag `3.0.0-draft.1` when it opens, `3.0.0` only if accepted. |

NEMAR decisions that shaped how stores are made, each an accepted nemar-cli ADR:
only raw recordings are converted (ADR 0027, 2026-08-20);
MEG recorded with internal active shielding is corrected before serving, or declined (ADR 0028, 2026-08-20);
bounded streaming is the default conversion path (ADR 0030, 2026-08-22);
the conversion queue stamps the engine version that made each dataset's stores (ADR 0033, 2026-09-01).

**Current scale, measured 2026-11-20 at 22:23 UTC.**
NEMAR serves 231,259 stores across 836 datasets, out of 910 public datasets, for 235,038 recordings.
The stores' durations sum to 418,624,671 seconds, about 116,285 hours.
We measured this read-only, from the public catalog:

```
curl -A "<a named client>" "https://api.nemar.org/datasets?limit=100&offset=N"    # N = 0, 100, ..., 1000
```

summing `zarr_store_count`, `recording_count` and `total_recording_duration` (seconds) over the 910 rows returned, and counting the rows where `zarr_store_count` is above zero.
The catalog field is the store count of each dataset's published index; we did not re-count the indexes themselves.
The other 3,779 recordings are those the catalog counts as conversion failures (truncated, corrupt or unsupported files); we did not examine each one.

**Not measured:** how many stores are at each `format_version`.
The catalog does not carry the version, and reading it would mean opening each store.
We infer that every served store is version 2,
because biosigIO has written version 2 since release 0.6.0 on 2026-05-31, and the oldest conversion still current in the catalog is dated 2026-06-12.
That date is also the earliest we can show that NEMAR served stores; earlier conversions were replaced, and their dates are not in the catalog.

## References

- The specification, version 2: <https://github.com/nemarOrg/biosig-zarr/blob/2.0.0/spec/index.md>
- The proposed text: <https://github.com/nemarOrg/biosig-zarr/compare/2.0.0...3.0.0-draft.1>
- NEMAR's store contract and format stability policy: <https://docs.nemar.org/platform/zarr/store-contract/>, <https://docs.nemar.org/platform/zarr/format-stability/>
- biosigIO: <https://github.com/neuromechanist/biosigio>
- The gap defect: <https://github.com/neuromechanist/biosigio/issues/180>, <https://github.com/mne-tools/mne-python/issues/13429>
- OME-Zarr RFC-9: <https://ngff.openmicroscopy.org/rfc/9/>
- `hdmf-zarr`: <https://nwb.org/tools/core/hdmf-zarr/>, <https://github.com/hdmf-dev/hdmf-zarr>
- BIDS: BEP 045 <https://bids.neuroimaging.io/extensions/beps/bep_045.html> and <https://github.com/bids-standard/bids-specification/pull/2267>; issues [2313](https://github.com/bids-standard/bids-specification/issues/2313), [1771](https://github.com/bids-standard/bids-specification/issues/1771), [1796](https://github.com/bids-standard/bids-specification/issues/1796) and [2463](https://github.com/bids-standard/bids-specification/issues/2463)
- Zarr version 3 core specification and the sharding codec: <https://zarr-specs.readthedocs.io/en/latest/v3/core/index.html>, <https://zarr-specs.readthedocs.io/en/latest/v3/codecs/sharding-indexed/index.html>
- NEMAR's decision records cited here (ADRs 0027, 0028, 0030, 0033, 0123, 0128, 0131) are in nemarOrg/nemar-cli, under `.context/decisions/`.

## Change log

- 2026-11-20: first draft, revised after an internal review the same day.
