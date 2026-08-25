from django.db import transaction
from rest_framework import serializers

from finance.services import profile_for_request

from .models import HousingCost, HousingScenario


class HousingCostSerializer(serializers.ModelSerializer):
    class Meta:
        model = HousingCost
        fields = ['id', 'category', 'amount']


class HousingScenarioSerializer(serializers.ModelSerializer):
    additional_costs = HousingCostSerializer(many=True, required=False)
    financing_amount = serializers.SerializerMethodField()
    monthly_instalment = serializers.SerializerMethodField()
    total_monthly_cost = serializers.SerializerMethodField()

    class Meta:
        model = HousingScenario
        fields = [
            'id', 'property_price', 'deposit', 'financing_rate', 'tenure_years',
            'known_monthly_payment', 'additional_costs', 'financing_amount',
            'monthly_instalment', 'total_monthly_cost', 'created_at', 'updated_at',
        ]

    def validate_additional_costs(self, costs):
        categories = [cost['category'].strip().casefold() for cost in costs]
        if len(categories) != len(set(categories)):
            raise serializers.ValidationError(
                'Each additional housing-cost category must be unique.'
            )
        return costs

    @transaction.atomic
    def create(self, validated_data):
        costs = validated_data.pop('additional_costs', [])
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['user'] = request.user
        elif request:
            validated_data['profile'] = profile_for_request(request)
        else:
            raise serializers.ValidationError(
                'A request context is required to assign the scenario owner.'
            )
        scenario = HousingScenario.objects.create(**validated_data)
        for cost in costs:
            HousingCost.objects.create(scenario=scenario, **cost)
        return scenario

    @transaction.atomic
    def update(self, instance, validated_data):
        costs = validated_data.pop('additional_costs', None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if costs is not None:
            instance.additional_costs.all().delete()
            for cost in costs:
                HousingCost.objects.create(scenario=instance, **cost)
        return instance

    def get_financing_amount(self, obj: HousingScenario) -> float:
        from .services import financing_amount
        return float(round(financing_amount(obj.property_price, obj.deposit), 2))

    def get_monthly_instalment(self, obj: HousingScenario) -> float:
        from .services import scenario_instalment
        return float(round(scenario_instalment(obj), 2))

    def get_total_monthly_cost(self, obj: HousingScenario) -> float:
        from .services import scenario_total_monthly_cost
        return float(round(scenario_total_monthly_cost(obj), 2))


class HousingCalculationCostSerializer(serializers.Serializer):
    category = serializers.CharField(max_length=100, required=False)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)


class HousingCalculationSerializer(serializers.Serializer):
    property_price = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)
    deposit = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)
    financing_rate = serializers.DecimalField(max_digits=6, decimal_places=3, min_value=0)
    tenure_years = serializers.IntegerField(min_value=1)
    known_monthly_payment = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=0,
        allow_null=True,
        required=False,
    )
    additional_costs = HousingCalculationCostSerializer(many=True, required=False)


class PreHousingCheckSerializer(serializers.Serializer):
    """Accept the prototype payload while the server uses the session-owned record.

    The optional fields keep older clients source-compatible. They are deliberately
    not passed to the calculation service.
    """

    income = serializers.ListField(child=serializers.DictField(), required=False)
    work_costs = serializers.ListField(child=serializers.DictField(), required=False)
    commitments = serializers.DictField(required=False)
    expenses = serializers.ListField(child=serializers.DictField(), required=False)


class HousingCalculationResultSerializer(serializers.Serializer):
    financing_amount = serializers.FloatField()
    monthly_instalment = serializers.FloatField()
    total_monthly_cost = serializers.FloatField()


class PreHousingMonthResultSerializer(serializers.Serializer):
    year = serializers.IntegerField()
    month = serializers.IntegerField(min_value=1, max_value=12)
    gross_income = serializers.FloatField()
    usable_income = serializers.FloatField()
    existing_costs = serializers.FloatField()
    surplus = serializers.FloatField()
    shortfall = serializers.FloatField(min_value=0)


class PreHousingWorstMonthSerializer(serializers.Serializer):
    year = serializers.IntegerField()
    month = serializers.IntegerField(min_value=1, max_value=12)


class PreHousingCheckResultSerializer(serializers.Serializer):
    provenance = serializers.ChoiceField(choices=['calculated_from_user_record'])
    work_cost_basis = serializers.ChoiceField(choices=['current_active_monthly_snapshot'])
    has_existing_shortfall = serializers.BooleanField()
    tested_months = serializers.IntegerField(min_value=0)
    largest_existing_gap = serializers.FloatField(min_value=0)
    worst_month = PreHousingWorstMonthSerializer(allow_null=True)
    months = PreHousingMonthResultSerializer(many=True)
