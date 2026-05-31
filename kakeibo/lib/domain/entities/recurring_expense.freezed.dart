// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'recurring_expense.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$RecurringExpense {
  int? get id => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError; // 支出名（メモとして自動入力される）
  double get amount => throw _privateConstructorUsedError;
  int get categoryId => throw _privateConstructorUsedError;
  int get dayOfMonth => throw _privateConstructorUsedError; // 毎月何日（1-31）
  bool get isActive => throw _privateConstructorUsedError;

  @JsonKey(ignore: true)
  $RecurringExpenseCopyWith<RecurringExpense> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $RecurringExpenseCopyWith<$Res> {
  factory $RecurringExpenseCopyWith(
          RecurringExpense value, $Res Function(RecurringExpense) then) =
      _$RecurringExpenseCopyWithImpl<$Res, RecurringExpense>;
  @useResult
  $Res call(
      {int? id,
      String name,
      double amount,
      int categoryId,
      int dayOfMonth,
      bool isActive});
}

/// @nodoc
class _$RecurringExpenseCopyWithImpl<$Res, $Val extends RecurringExpense>
    implements $RecurringExpenseCopyWith<$Res> {
  _$RecurringExpenseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = freezed,
    Object? name = null,
    Object? amount = null,
    Object? categoryId = null,
    Object? dayOfMonth = null,
    Object? isActive = null,
  }) {
    return _then(_value.copyWith(
      id: freezed == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as int?,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      amount: null == amount
          ? _value.amount
          : amount // ignore: cast_nullable_to_non_nullable
              as double,
      categoryId: null == categoryId
          ? _value.categoryId
          : categoryId // ignore: cast_nullable_to_non_nullable
              as int,
      dayOfMonth: null == dayOfMonth
          ? _value.dayOfMonth
          : dayOfMonth // ignore: cast_nullable_to_non_nullable
              as int,
      isActive: null == isActive
          ? _value.isActive
          : isActive // ignore: cast_nullable_to_non_nullable
              as bool,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$RecurringExpenseImplCopyWith<$Res>
    implements $RecurringExpenseCopyWith<$Res> {
  factory _$$RecurringExpenseImplCopyWith(_$RecurringExpenseImpl value,
          $Res Function(_$RecurringExpenseImpl) then) =
      __$$RecurringExpenseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {int? id,
      String name,
      double amount,
      int categoryId,
      int dayOfMonth,
      bool isActive});
}

/// @nodoc
class __$$RecurringExpenseImplCopyWithImpl<$Res>
    extends _$RecurringExpenseCopyWithImpl<$Res, _$RecurringExpenseImpl>
    implements _$$RecurringExpenseImplCopyWith<$Res> {
  __$$RecurringExpenseImplCopyWithImpl(_$RecurringExpenseImpl _value,
      $Res Function(_$RecurringExpenseImpl) _then)
      : super(_value, _then);

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = freezed,
    Object? name = null,
    Object? amount = null,
    Object? categoryId = null,
    Object? dayOfMonth = null,
    Object? isActive = null,
  }) {
    return _then(_$RecurringExpenseImpl(
      id: freezed == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as int?,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      amount: null == amount
          ? _value.amount
          : amount // ignore: cast_nullable_to_non_nullable
              as double,
      categoryId: null == categoryId
          ? _value.categoryId
          : categoryId // ignore: cast_nullable_to_non_nullable
              as int,
      dayOfMonth: null == dayOfMonth
          ? _value.dayOfMonth
          : dayOfMonth // ignore: cast_nullable_to_non_nullable
              as int,
      isActive: null == isActive
          ? _value.isActive
          : isActive // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc

class _$RecurringExpenseImpl implements _RecurringExpense {
  const _$RecurringExpenseImpl(
      {this.id,
      required this.name,
      required this.amount,
      required this.categoryId,
      required this.dayOfMonth,
      this.isActive = true});

  @override
  final int? id;
  @override
  final String name;
// 支出名（メモとして自動入力される）
  @override
  final double amount;
  @override
  final int categoryId;
  @override
  final int dayOfMonth;
// 毎月何日（1-31）
  @override
  @JsonKey()
  final bool isActive;

  @override
  String toString() {
    return 'RecurringExpense(id: $id, name: $name, amount: $amount, categoryId: $categoryId, dayOfMonth: $dayOfMonth, isActive: $isActive)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$RecurringExpenseImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.amount, amount) || other.amount == amount) &&
            (identical(other.categoryId, categoryId) ||
                other.categoryId == categoryId) &&
            (identical(other.dayOfMonth, dayOfMonth) ||
                other.dayOfMonth == dayOfMonth) &&
            (identical(other.isActive, isActive) ||
                other.isActive == isActive));
  }

  @override
  int get hashCode => Object.hash(
      runtimeType, id, name, amount, categoryId, dayOfMonth, isActive);

  @JsonKey(ignore: true)
  @override
  @pragma('vm:prefer-inline')
  _$$RecurringExpenseImplCopyWith<_$RecurringExpenseImpl> get copyWith =>
      __$$RecurringExpenseImplCopyWithImpl<_$RecurringExpenseImpl>(
          this, _$identity);
}

abstract class _RecurringExpense implements RecurringExpense {
  const factory _RecurringExpense(
      {final int? id,
      required final String name,
      required final double amount,
      required final int categoryId,
      required final int dayOfMonth,
      final bool isActive}) = _$RecurringExpenseImpl;

  @override
  int? get id;
  @override
  String get name;
  @override // 支出名（メモとして自動入力される）
  double get amount;
  @override
  int get categoryId;
  @override
  int get dayOfMonth;
  @override // 毎月何日（1-31）
  bool get isActive;
  @override
  @JsonKey(ignore: true)
  _$$RecurringExpenseImplCopyWith<_$RecurringExpenseImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
